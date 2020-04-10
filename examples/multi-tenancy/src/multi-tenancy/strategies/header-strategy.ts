// Copyright IBM Corp. 2020. All Rights Reserved.
// Node module: @loopback/example-multi-tenancy
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {RequestContext} from '@loopback/rest';
import {MultiTenancyStrategy} from '../types';
import {BaseStrategy} from './base-strategy';

/**
 * Use `x-tenant-id` http header to identify the tenant id
 */
export class HeaderStrategy extends BaseStrategy
  implements MultiTenancyStrategy {
  name = 'header';

  identifyTenant(requestContext: RequestContext) {
    const tenantId = requestContext.request.headers['x-tenant-id'] as string;
    return tenantId == null ? undefined : {id: tenantId};
  }
}
