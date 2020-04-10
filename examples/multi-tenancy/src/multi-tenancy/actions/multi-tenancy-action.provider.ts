// Copyright IBM Corp. 2019,2020. All Rights Reserved.
// Node module: @loopback/authentication
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {ContextTags, Getter, inject, Provider} from '@loopback/context';
import {extensionPoint, extensions} from '@loopback/core';
import {RequestContext} from '@loopback/rest';
import debugFactory from 'debug';
import {MultiTenancyBindings, MULTI_TENANCY_STRATEGIES} from '../keys';
import {MultiTenancyAction, MultiTenancyStrategy} from '../types';
const debug = debugFactory('loopback:sequence:action:multi-tenancy');
/**
 * Provides the multi-tenancy action for a sequence
 */
@extensionPoint(MULTI_TENANCY_STRATEGIES, {
  tags: {
    [ContextTags.KEY]: MultiTenancyBindings.ACTION,
  },
})
export class MultiTenancyActionProvider
  implements Provider<MultiTenancyAction> {
  constructor(
    @extensions()
    private readonly getMultiTenancyStrategies: Getter<MultiTenancyStrategy[]>,
    @inject(MultiTenancyBindings.STRATEGIES, {optional: true})
    private strategyNames = ['header'],
  ) {}

  /**
   * @returns MultiTenancyStrategyFactory
   */
  value(): MultiTenancyAction {
    return this.action.bind(this);
  }

  /**
   * The implementation of authenticate() sequence action.
   * @param request - The incoming request provided by the REST layer
   */
  async action(requestCtx: RequestContext) {
    debug('Identifying tenant for request %s', requestCtx.basePath);
    const tenancy = await this.identifyTenancy(requestCtx);
    if (tenancy == null) return;
    debug(
      'Tenant identified by strategy %s',
      tenancy.strategy.name,
      tenancy.tenant,
    );
    debug('Binding resources for tenant', tenancy.tenant);
    requestCtx.bind(MultiTenancyBindings.CURRENT_TENANT).to(tenancy.tenant);
    await tenancy.strategy.bindResources(requestCtx, tenancy.tenant);
    return tenancy.tenant;
  }

  private async identifyTenancy(requestCtx: RequestContext) {
    debug('Tenancy strategy names configured', this.strategyNames);
    let strategies = await this.getMultiTenancyStrategies();
    strategies = strategies
      .filter(s => this.strategyNames.includes(s.name))
      .sort((a, b) => {
        return (
          this.strategyNames.indexOf(b.name) -
          this.strategyNames.indexOf(a.name)
        );
      });
    if (debug.enabled) {
      debug(
        'Tenancy strategies',
        strategies.map(s => s.name),
      );
    }
    for (const strategy of strategies) {
      debug('Trying tenancy strategy %s', strategy.name);
      const tenant = await strategy.identifyTenant(requestCtx);
      if (tenant != null) {
        debug('Tenant is now identified by strategy %s', strategy.name, tenant);
        return {tenant, strategy};
      }
    }
    debug('No tenant is identified');
    return undefined;
  }
}
