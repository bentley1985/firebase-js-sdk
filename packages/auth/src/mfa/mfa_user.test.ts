/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';

import { FactorId } from '../model/public_types';

import { mockEndpoint } from '../../test/helpers/api/helper';
import { testAuth, testUser, TestAuth } from '../../test/helpers/mock_auth';
import * as mockFetch from '../../test/helpers/mock_fetch';
import { Endpoint } from '../api';
import { APIUserInfo } from '../api/account_management/account';
import { FinalizeMfaResponse } from '../api/authentication/mfa';
import { ServerError } from '../api/errors';
import { UserInternal } from '../model/user';
import { MultiFactorInfoImpl } from './mfa_info';
import { MultiFactorSessionImpl, MultiFactorSessionType } from './mfa_session';
import { multiFactor, MultiFactorUserImpl } from './mfa_user';
import { MultiFactorAssertionImpl } from './mfa_assertion';
import { AuthInternal } from '../model/auth';
import { makeJWT } from '../../test/helpers/jwt';

use(chaiAsPromised);

class MockMultiFactorAssertion extends MultiFactorAssertionImpl {
  constructor(readonly response: FinalizeMfaResponse) {
    super(FactorId.PHONE);
  }

  async _finalizeEnroll(
    _auth: AuthInternal,
    _idToken: string,
    _displayName?: string | null
  ): Promise<FinalizeMfaResponse> {
    return this.response;
  }
  async _finalizeSignIn(
    _auth: AuthInternal,
    _mfaPendingCredential: string
  ): Promise<FinalizeMfaResponse> {
    return this.response;
  }
}

describe('core/mfa/mfa_user/MultiFactorUser', () => {
  const idToken = makeJWT({ 'exp': '3600', 'iat': '1200' });
  let auth: TestAuth;
  let mfaUser: MultiFactorUserImpl;
  let clock: sinon.SinonFakeTimers;

  beforeEach(async () => {
    auth = await testAuth();
    mockFetch.setUp();
    clock = sinon.useFakeTimers();
    mfaUser = MultiFactorUserImpl._fromUser(
      testUser(auth, 'uid', undefined, true)
    );
  });

  afterEach(() => {
    mockFetch.tearDown();
    sinon.restore();
  });

  describe('getSession', () => {
    it('should return the id token', async () => {
      const mfaSession = (await mfaUser.getSession()) as MultiFactorSessionImpl;
      expect(mfaSession.type).to.eq(MultiFactorSessionType.ENROLL);
      expect(mfaSession.credential).to.eq('access-token');
    });
    it('should contain a reference to auth', async () => {
      const mfaSession = (await mfaUser.getSession()) as MultiFactorSessionImpl;
      expect(mfaSession.type).to.eq(MultiFactorSessionType.ENROLL);
      expect(mfaSession.credential).to.eq('access-token');
      expect(mfaSession.auth).to.eq(auth);
    });
  });

  describe('enroll', () => {
    let assertion: MultiFactorAssertionImpl;

    const serverUser: APIUserInfo = {
      localId: 'local-id',
      displayName: 'display-name',
      photoUrl: 'photo-url',
      email: 'email',
      emailVerified: true,
      phoneNumber: 'phone-number',
      tenantId: 'tenant-id',
      createdAt: 123,
      lastLoginAt: 456,
      mfaInfo: [
        {
          mfaEnrollmentId: 'mfa-id',
          enrolledAt: Date.now(),
          phoneInfo: 'phone-number'
        }
      ]
    };

    const serverResponse: FinalizeMfaResponse = {
      idToken,
      refreshToken: 'refresh-token'
    };

    beforeEach(() => {
      assertion = new MockMultiFactorAssertion(serverResponse);

      mockEndpoint(Endpoint.GET_ACCOUNT_INFO, {
        users: [serverUser]
      });
    });

    it('should update the tokens', async () => {
      await mfaUser.enroll(assertion);

      expect(await mfaUser.user.getIdToken()).to.eq(idToken);
      expect(mfaUser.user.stsTokenManager.expirationTime).to.eq(
        clock.now + 2400 * 1000
      );
    });

    it('should update the enrolled Factors', async () => {
      await mfaUser.enroll(assertion);

      expect(mfaUser.enrolledFactors.length).to.eq(1);
      const enrolledFactor = mfaUser.enrolledFactors[0];
      expect(enrolledFactor.factorId).to.eq(FactorId.PHONE);
      expect(enrolledFactor.uid).to.eq('mfa-id');
    });
  });

  describe('unenroll', () => {
    let withdrawMfaEnrollmentMock: mockFetch.Route;

    const serverResponse: FinalizeMfaResponse = {
      idToken,
      refreshToken: 'refresh-token'
    };

    const mfaInfo = MultiFactorInfoImpl._fromServerResponse(auth, {
      mfaEnrollmentId: 'mfa-id',
      enrolledAt: Date.now(),
      phoneInfo: 'phone-info'
    });

    const otherMfaInfo = MultiFactorInfoImpl._fromServerResponse(auth, {
      mfaEnrollmentId: 'other-mfa-id',
      enrolledAt: Date.now(),
      phoneInfo: 'other-phone-info'
    });

    const serverUser: APIUserInfo = {
      localId: 'local-id',
      mfaInfo: [
        {
          mfaEnrollmentId: 'other-mfa-id',
          enrolledAt: Date.now(),
          phoneInfo: 'other-phone-info'
        }
      ]
    };

    beforeEach(() => {
      withdrawMfaEnrollmentMock = mockEndpoint(
        Endpoint.WITHDRAW_MFA,
        serverResponse
      );
      mfaUser.enrolledFactors = [mfaInfo, otherMfaInfo];

      mockEndpoint(Endpoint.GET_ACCOUNT_INFO, {
        users: [serverUser]
      });
    });

    it('should withdraw the MFA', async () => {
      await mfaUser.unenroll(mfaInfo);

      expect(withdrawMfaEnrollmentMock.calls[0].request).to.eql({
        idToken: 'access-token',
        mfaEnrollmentId: mfaInfo.uid
      });
    });

    it('should remove matching enrollment factors but leave any others', async () => {
      await mfaUser.unenroll(mfaInfo);

      expect(mfaUser.enrolledFactors).to.eql([otherMfaInfo]);
    });

    it('should support passing a string instead of MultiFactorInfo', async () => {
      await mfaUser.unenroll(mfaInfo.uid);

      expect(withdrawMfaEnrollmentMock.calls[0].request).to.eql({
        idToken: 'access-token',
        mfaEnrollmentId: mfaInfo.uid
      });
    });

    it('should update the tokens', async () => {
      await mfaUser.unenroll(mfaInfo);

      expect(await mfaUser.user.getIdToken()).to.eq(idToken);
      expect(mfaUser.user.stsTokenManager.expirationTime).to.eq(
        clock.now + 2400 * 1000
      );
    });

    context('token revoked by backend', () => {
      beforeEach(() => {
        mockEndpoint(
          Endpoint.GET_ACCOUNT_INFO,
          {
            error: {
              message: ServerError.TOKEN_EXPIRED
            }
          },
          403
        );
      });

      it('should swallow the error', async () => {
        await mfaUser.unenroll(mfaInfo);
      });
    });
  });
});

describe('core/mfa/mfa_user/multiFactor', () => {
  let auth: TestAuth;
  let user: UserInternal;

  beforeEach(async () => {
    auth = await testAuth();
    user = testUser(auth, 'uid', undefined, true);
  });

  it('can be used to a create a MultiFactorUser', () => {
    const mfaUser = multiFactor(user);
    expect((mfaUser as MultiFactorUserImpl).user).to.eq(user);
  });

  it('should only create one instance of an MFA user per User', () => {
    const mfaUser = multiFactor(user);
    expect(multiFactor(user)).to.eq(mfaUser);
  });

  context('enrolledFactors', () => {
    const serverUser: APIUserInfo = {
      localId: 'local-id',
      mfaInfo: [
        {
          mfaEnrollmentId: 'enrollment-id',
          enrolledAt: Date.now(),
          phoneInfo: 'masked-phone-number'
        }
      ]
    };

    const updatedServerUser: APIUserInfo = {
      localId: 'local-id',
      mfaInfo: [
        {
          mfaEnrollmentId: 'enrollment-id',
          enrolledAt: Date.now(),
          phoneInfo: 'masked-phone-number'
        },
        {
          mfaEnrollmentId: 'new-enrollment-id',
          enrolledAt: Date.now(),
          phoneInfo: 'other-masked-phone-number'
        }
      ]
    };

    beforeEach(() => {
      mockFetch.setUp();
      mockEndpoint(Endpoint.GET_ACCOUNT_INFO, {
        users: [serverUser]
      });
    });

    afterEach(mockFetch.tearDown);

    it('should initialize the enrolled factors from the last reload', async () => {
      await user.reload();
      const mfaUser = multiFactor(user);
      expect(mfaUser.enrolledFactors.length).to.eq(1);
      const mfaInfo = mfaUser.enrolledFactors[0];
      expect(mfaInfo.uid).to.eq('enrollment-id');
      expect(mfaInfo.factorId).to.eq(FactorId.PHONE);
    });

    it('should update the enrolled factors if the user is reloaded', async () => {
      await user.reload();
      const mfaUser = multiFactor(user);
      expect(mfaUser.enrolledFactors.length).to.eq(1);
      mockEndpoint(Endpoint.GET_ACCOUNT_INFO, {
        users: [updatedServerUser]
      });
      await user.reload();
      expect(mfaUser.enrolledFactors.length).to.eq(2);
    });
  });
});
