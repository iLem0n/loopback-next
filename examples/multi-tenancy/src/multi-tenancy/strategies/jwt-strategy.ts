// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/example-multi-tenancy
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RequestContext} from '@loopback/rest';
import {decode} from 'jsonwebtoken';
import {MultiTenancyStrategy} from '../types';
import {BaseStrategy} from './base-strategy';

/**
 * Use jwt token to identify the tenant id
 */
export class JWTStrategy extends BaseStrategy implements MultiTenancyStrategy {
  name = 'jwt';

  identifyTenant(requestContext: RequestContext) {
    const authorization = requestContext.request.headers[
      'authorization'
    ] as string;
    if (authorization?.startsWith('Bearer ')) {
      //split the string into 2 parts : 'Bearer ' and the `xxx.yyy.zzz`
      const parts = authorization.split(' ');
      const token = parts[1];
      const json = decode(token, {json: true});
      const tenantId = json?.tenantid;
      return tenantId == null ? undefined : {id: tenantId};
    }
  }
}
