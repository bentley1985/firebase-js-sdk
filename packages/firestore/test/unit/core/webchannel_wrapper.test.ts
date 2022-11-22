/**
 * @license
 * Copyright 2022 Google LLC
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

// Add some unit tests for classes exported from @firebase/webchannel-wrapper.
// These tests are mostly to ensure that the exported classes correctly map to
// underlying functionality from google-closure-library.

import { Integer } from '@firebase/webchannel-wrapper';
import { expect } from 'chai';

// TODO: REMOVE ONLY()
describe.only('Integer', () => {
  it('constructor should create distinct instances', () => {
    const instance1 = new Integer([1], 0);
    const instance2 = new Integer([1], 0);
    expect(instance1).is.instanceof(Integer);
    expect(instance2).is.instanceof(Integer);
    expect(instance1).is.not.equal(instance2);
  });

  it('constructor should construct 1 and -1, 2 and -2', () => {
    const positiveOne = new Integer([1], 0);
    expect(positiveOne.toNumber()).equals(1);
    const negativeOne = new Integer([-1], -1);
    expect(negativeOne.toNumber()).equals(-1);
    const positiveTwo = new Integer([2], 0);
    expect(positiveTwo.toNumber()).equals(2);
    const negativeTwo = new Integer([-2], -1);
    expect(negativeTwo.toNumber()).equals(-2);
  });

  it('constructor should construct big positive values', () => {
    expect(new Integer([0xff], 0).toNumber()).equals(255);
    expect(new Integer([0xffff], 0).toNumber()).equals(65535);
    expect(new Integer([0xffffff], 0).toNumber()).equals(16777215);
    expect(new Integer([0xffffffff], 0).toNumber()).equals(4294967295);
    expect(new Integer([0, 1], 0).toNumber()).equals(4294967296);
    expect(new Integer([1, 1], 0).toNumber()).equals(4294967297);
    expect(new Integer([0xfffffffe, 1], 0).toNumber()).equals(8589934590);
    expect(new Integer([0xffffffff, 1], 0).toNumber()).equals(8589934591);
    expect(new Integer([0, 2], 0).toNumber()).equals(8589934592);
    expect(new Integer([1, 2], 0).toNumber()).equals(8589934593);
    expect(new Integer([0x992ce530, 0xbc1f3bbb, 0x2080e2ee, 0xe53c0595], 0).toString()).equals("304704862073361391914321619654827369776");
  });

  it('constructor should construct big negative values', () => {
    expect(new Integer([0xffffffff], -1).toNumber()).equals(-1);
    expect(new Integer([0xfffffffe], -1).toNumber()).equals(-2);
    expect(new Integer([0xfffffffd], -1).toNumber()).equals(-3);
    expect(new Integer([0xfffffff0], -1).toNumber()).equals(-16);
    expect(new Integer([0xffffff00], -1).toNumber()).equals(-256);
    expect(new Integer([0xfffff000], -1).toNumber()).equals(-4096);
    expect(new Integer([0xffff0000], -1).toNumber()).equals(-65536);
    expect(new Integer([0xfff00000], -1).toNumber()).equals(-1048576);
    expect(new Integer([0xff000000], -1).toNumber()).equals(-16777216);
    expect(new Integer([0xf0000000], -1).toNumber()).equals(-268435456);
    expect(new Integer([0x00000001], -1).toNumber()).equals(-4294967295);
    expect(new Integer([0x00000000], -1).toNumber()).equals(-4294967296);
    expect(new Integer([0x00000000, 0xffffffff], -1).toNumber()).equals(-4294967296);
    expect(new Integer([0xffffffff, 0xfffffffe], -1).toNumber()).equals(-4294967297);
    expect(new Integer([0xfffffffe, 0xfffffffe], -1).toNumber()).equals(-4294967298);
  });

  it('add() should produce the sum of the two numbers', () => {
    expect(Integer.fromNumber(0).add(Integer.fromNumber(0)).toNumber()).equals(0);
    expect(Integer.fromNumber(1).add(Integer.fromNumber(1)).toNumber()).equals(2);
    expect(Integer.fromNumber(0xffffffff).add(Integer.fromNumber(1)).toNumber()).equals(4294967296);
    expect(Integer.fromString("304704862073361391914321619654827369776").add(Integer.fromString("77393247566944052149773810817307943505")).toString()).equals("382098109640305444064095430472135313281");
    expect(Integer.fromNumber(0).add(Integer.fromNumber(-1)).toNumber()).equals(-1);
  });

  it('multiply() should produce the product of the two numbers', () => {
    expect(Integer.fromNumber(0).multiply(Integer.fromNumber(0)).toNumber()).equals(0);
    expect(Integer.fromNumber(1).multiply(Integer.fromNumber(0)).toNumber()).equals(0);
    expect(Integer.fromNumber(1).multiply(Integer.fromNumber(1)).toNumber()).equals(1);
    expect(Integer.fromNumber(9).multiply(Integer.fromNumber(3)).toNumber()).equals(27);
    expect(Integer.fromNumber(0xffffffff).multiply(Integer.fromNumber(0xca11ba11)).toString()).equals("14560623649052575215");
    expect(Integer.fromString("304704862073361391914321619654827369776").multiply(Integer.fromString("77393247566944052149773810817307943505")).toString()).equals("23582098825295199538298333106941184620809785262540690532878112097410752504880");
    expect(Integer.fromNumber(5).multiply(Integer.fromNumber(-1)).toNumber()).equals(-5);
  });

  it('modulo() should produce the division remainder of the two numbers', () => {
    expect(() => Integer.fromNumber(0).modulo(Integer.fromNumber(0))).to.throw("division by zero");
    expect(() => Integer.fromNumber(42).modulo(Integer.fromNumber(0))).to.throw("division by zero");
    expect(Integer.fromNumber(20).modulo(Integer.fromNumber(1)).toNumber()).equals(0);
    expect(Integer.fromNumber(2).modulo(Integer.fromNumber(2)).toNumber()).equals(0);
    expect(Integer.fromNumber(3).modulo(Integer.fromNumber(2)).toNumber()).equals(1);
    expect(Integer.fromNumber(4).modulo(Integer.fromNumber(2)).toNumber()).equals(0);
    expect(Integer.fromNumber(0xffffffff).modulo(Integer.fromNumber(0xca11ba11)).toNumber()).equals(904807918);
    expect(Integer.fromString("304704862073361391914321619654827369776").modulo(Integer.fromString("77393247566944052149773810817307943505")).toString()).equals("72525119372529235465000187202903539261");
    expect(Integer.fromString("304704862073361391914321619654827369776").modulo(Integer.fromNumber(313)).toNumber()).equals(167);
  });

  it('compare() should correctly compare two numbers for order', () => {
    const numbers = Object.freeze([
      Integer.fromNumber(-4294967298),
      Integer.fromNumber(-2),
      Integer.fromNumber(-1),
      Integer.fromNumber(0),
      Integer.fromNumber(1),
      Integer.fromNumber(2),
      Integer.fromNumber(0xffffffff),
      Integer.fromString("77393247566944052149773810817307943505"),
      Integer.fromString("304704862073361391914321619654827369776"),
    ]);
    for (let i1 = 0; i1 < numbers.length; i1++) {
      for (let i2 = 0; i2 < numbers.length; i2++) {
        const num1 = numbers[i1];
        const num2 = numbers[i2];
        const expected = (i1 == i2) ? 0 : ((i1 < i2) ? -1 : 1);
        expect(num1.compare(num2)).equals(expected);
      }
    }
  });
});
