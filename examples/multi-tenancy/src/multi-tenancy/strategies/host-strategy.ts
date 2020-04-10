// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/example-multi-tenancy
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RequestContext} from '@loopback/rest';
import {MultiTenancyStrategy} from '../types';
import {BaseStrategy} from './base-strategy';

/**
 * Use `host` to identify the tenant id
 */
export class HostStrategy extends BaseStrategy implements MultiTenancyStrategy {
  name = 'host';

  identifyTenant(requestContext: RequestContext) {
    const host = requestContext.request.headers.host;
    return host == null ? undefined : {id: host};
  }
}
