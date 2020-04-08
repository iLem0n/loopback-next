// Copyright IBM Corp. 2019. All Rights Reserved.
// Node module: @loopback/authentication-passport
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Client, supertest, expect} from '@loopback/testlab';
import {setupExpressApplication} from './test-helper';
import {MockTestOauth2SocialApp} from '@loopback/authentication-passport';
import {ExpressServer} from '../../server';
import * as url from 'url';
import qs from 'qs';

describe('example-passport-login acceptance test', () => {
  let server: ExpressServer;
  let client: Client;
  let Cookie: string;

  before('setupApplication', async () => {
    ({server, client} = await setupExpressApplication());
  });

  after('closes application', async () => {
    await server.stop();
  });

  /**
   * This test uses the mock social app from the @loopback/authentication-passport package,
   * as oauth2 profile endpoint.
   */
  before(MockTestOauth2SocialApp.startMock);
  after(MockTestOauth2SocialApp.stopMock);

  /**
   * Scenarios to test:
   *    Scenario 1: Signing up as a NEW user
   *         User is able to create a local user profile by signing in with
   *         an email-id and password, if the email id is not registered already.
   *
   *    Scenario 2. Link an external profile with a local user
   *         After the user signs up, user is able to link local account with an
   *         external profile in a social app, if the email id is same.
   *
   *    Scenario 3. Sign Up (create a new user) via an external profile
   *         When a user attempts to sign up with an external profile, and the email-id
   *         in the profile is not registered locally, a new local account is created
   */

  describe('User login scenarios', () => {
    /**
     *  Scenario 1. Signing up as a NEW user
     *    Test case 1: sign up as a new user locally, provide email id and password
     *    Test case 2: login as the new user with email id
     *    Test case 3: logout
     */

    context('Scenario 1. Signing up as a NEW user', () => {
      /**
       * create a local account in the loopback app with the following profile
       *     username: test@example.com
       *     email: test@example.com
       */
      it('signup as new user with loopback app', async () => {
        const response: supertest.Response = await client
          .post('/users/signup')
          .type('form')
          .send({
            name: 'Test User',
            email: 'test@example.com',
            username: 'test@example.com',
            password: 'password',
          })
          .expect(302);
        const redirectUrl = response.get('Location');
        expect(redirectUrl).to.equal('/login');
      });

      it('login to loopback app', async () => {
        const response: supertest.Response = await client
          .post('/login_submit')
          .type('form')
          .send({
            email: 'test@example.com',
            password: 'password',
          })
          .expect(302);
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
      });

      it('able to access account profile page while logged in', async () => {
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(200);
      });

      it('access to account profile page is denied after log out', async () => {
        const response = await client
          .get('/logout')
          .set('Cookie', [Cookie])
          .expect(302);
        /**
         * replace existing cookie with cookie from logout response
         */
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(401);
      });
    });

    /**
     *  Scenario 2. Link an external profile with a local user
     *    Test case 1: login via a social app profile having same email id as local user
     *    Test case 2: check if external profile is linked to local user
     *    Test case 3: logout
     */
    context('Scenario 2. Link an external profile with a local user', () => {
      let oauthProviderUrl: string;
      let providerLoginUrl: string;
      let loginPageParams: string;
      let callbackToLbApp: string;

      it('call is redirected to third party authorization url', async () => {
        const response = await client
          .get('/api/auth/thirdparty/oauth2')
          .expect(303);
        oauthProviderUrl = response.get('Location');
        expect(url.parse(oauthProviderUrl).pathname).to.equal('/oauth/dialog');
      });

      it('call to authorization url is redirected to oauth providers login page', async () => {
        const response = await supertest('').get(oauthProviderUrl).expect(302);
        providerLoginUrl = response.get('Location');
        loginPageParams = url.parse(providerLoginUrl).query ?? '';
        expect(url.parse(response.get('Location')).pathname).to.equal('/login');
      });

      /**
       * Sign Up via a social app with the following profile
       *   username: testuser
       *   email: test@example.com
       *
       * Email-id MATCHES local account
       */
      it('login page redirects to authorization app callback endpoint', async () => {
        const loginPageHiddenParams = qs.parse(loginPageParams);
        const params = {
          username: 'testuser',
          password: 'xyz',
          // eslint-disable-next-line @typescript-eslint/camelcase
          client_id: loginPageHiddenParams.client_id,
          // eslint-disable-next-line @typescript-eslint/camelcase
          redirect_uri: loginPageHiddenParams.redirect_uri,
          scope: loginPageHiddenParams.scope,
        };
        // On successful login, the authorizing app redirects to the callback url
        // HTTP status code 302 is returned to the browser
        const response = await supertest('')
          .post('http://localhost:9000/login_submit')
          .send(qs.stringify(params))
          .expect(302);
        callbackToLbApp = response.get('Location');
        expect(url.parse(callbackToLbApp).pathname).to.equal(
          '/api/auth/thirdparty/oauth2/callback',
        );
      });

      it('callback url contains access code', async () => {
        expect(url.parse(callbackToLbApp).query).to.containEql('code');
      });

      it('access code can be exchanged for token', async () => {
        const path: string = url.parse(callbackToLbApp).path ?? '';
        const response = await client.get(path).expect(302);
        expect(response.get('Location')).to.equal('/auth/account');
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
      });

      it('able to access account profile page while logged in', async () => {
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(200);
      });

      it('access to account profile page is denied after log out', async () => {
        const response = await client
          .get('/logout')
          .set('Cookie', [Cookie])
          .expect(302);
        /**
         * replace existing cookie with cookie from logout response
         */
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(401);
      });
    });

    /**
     *  Sign Up (create a new user) via an external profile
     *    Test case 1: login via a social app profile having an email id not in local user registry
     *    Test case 2: check if new user is created for external profile
     *    Test case 3: logout
     */
    context('Sign Up (create a new user) via an external profile', () => {
      let oauthProviderUrl: string;
      let providerLoginUrl: string;
      let loginPageParams: string;
      let callbackToLbApp: string;

      it('call is redirected to third party authorization url', async () => {
        const response = await client
          .get('/api/auth/thirdparty/oauth2')
          .expect(303);
        oauthProviderUrl = response.get('Location');
        expect(url.parse(oauthProviderUrl).pathname).to.equal('/oauth/dialog');
      });

      it('call to authorization url is redirected to oauth providers login page', async () => {
        const response = await supertest('').get(oauthProviderUrl).expect(302);
        providerLoginUrl = response.get('Location');
        loginPageParams = url.parse(providerLoginUrl).query ?? '';
        expect(url.parse(response.get('Location')).pathname).to.equal('/login');
      });

      /**
       * Sign Up via a social app with the following profile
       *   username: user1
       *   email: usr1@lb.com
       *
       * Email-id NOT registered in local accounts
       */
      it('login page redirects to authorization app callback endpoint', async () => {
        const loginPageHiddenParams = qs.parse(loginPageParams);
        const params = {
          username: 'user1',
          password: 'abc',
          // eslint-disable-next-line @typescript-eslint/camelcase
          client_id: loginPageHiddenParams.client_id,
          // eslint-disable-next-line @typescript-eslint/camelcase
          redirect_uri: loginPageHiddenParams.redirect_uri,
          scope: loginPageHiddenParams.scope,
        };
        // On successful login, the authorizing app redirects to the callback url
        // HTTP status code 302 is returned to the browser
        const response = await supertest('')
          .post('http://localhost:9000/login_submit')
          .send(qs.stringify(params))
          .expect(302);
        callbackToLbApp = response.get('Location');
        expect(url.parse(callbackToLbApp).pathname).to.equal(
          '/api/auth/thirdparty/oauth2/callback',
        );
      });

      it('callback url contains access code', async () => {
        expect(url.parse(callbackToLbApp).query).to.containEql('code');
      });

      it('access code can be exchanged for token', async () => {
        const path: string = url.parse(callbackToLbApp).path ?? '';
        const response = await client.get(path).expect(302);
        expect(response.get('Location')).to.equal('/auth/account');
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
      });

      it('able to access account profile page while logged in', async () => {
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(200);
      });

      it('access to account profile page is denied after log out', async () => {
        const response = await client
          .get('/logout')
          .set('Cookie', [Cookie])
          .expect(302);
        /**
         * replace existing cookie with cookie from logout response
         */
        const setCookie: string[] = response.get('Set-Cookie');
        if (setCookie?.length) {
          Cookie = setCookie[0].split(';')[0];
        }
        expect(Cookie).to.containEql('session');
        await client.get('/auth/account').set('Cookie', [Cookie]).expect(401);
      });
    });
  });
});
