/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import expect from '@kbn/expect';
import uuid from 'uuid';
import { omit, mapValues } from 'lodash';
import moment from 'moment';
import { FtrProviderContext } from '../../ftr_provider_context';

export default ({ getPageObjects, getService }: FtrProviderContext) => {
  const testSubjects = getService('testSubjects');
  const pageObjects = getPageObjects(['common', 'triggersActionsUI', 'header', 'alertDetailsUI']);
  const browser = getService('browser');
  const log = getService('log');
  const alerting = getService('alerting');
  const retry = getService('retry');

  describe('Alert Details', function() {
    describe('Header', function() {
      const testRunUuid = uuid.v4();
      before(async () => {
        await pageObjects.common.navigateToApp('triggersActions');

        const actions = await Promise.all([
          alerting.actions.createAction({
            name: `server-log-${testRunUuid}-${0}`,
            actionTypeId: '.server-log',
            config: {},
            secrets: {},
          }),
          alerting.actions.createAction({
            name: `server-log-${testRunUuid}-${1}`,
            actionTypeId: '.server-log',
            config: {},
            secrets: {},
          }),
        ]);

        const alert = await alerting.alerts.createAlwaysFiringWithActions(
          `test-alert-${testRunUuid}`,
          actions.map(action => ({
            id: action.id,
            group: 'default',
            params: {
              message: 'from alert 1s',
              level: 'warn',
            },
          }))
        );

        // refresh to see alert
        await browser.refresh();

        await pageObjects.header.waitUntilLoadingHasFinished();

        // Verify content
        await testSubjects.existOrFail('alertsList');

        // click on first alert
        await pageObjects.triggersActionsUI.clickOnAlertInAlertsList(alert.name);
      });

      it('renders the alert details', async () => {
        const headingText = await pageObjects.alertDetailsUI.getHeadingText();
        expect(headingText).to.be(`test-alert-${testRunUuid}`);

        const alertType = await pageObjects.alertDetailsUI.getAlertType();
        expect(alertType).to.be(`Always Firing`);

        const { actionType, actionCount } = await pageObjects.alertDetailsUI.getActionsLabels();
        expect(actionType).to.be(`Server log`);
        expect(actionCount).to.be(`+1`);
      });

      it('should disable the alert', async () => {
        const enableSwitch = await testSubjects.find('enableSwitch');

        const isChecked = await enableSwitch.getAttribute('aria-checked');
        expect(isChecked).to.eql('true');

        await enableSwitch.click();

        const enabledSwitchAfterDisabling = await testSubjects.find('enableSwitch');
        const isCheckedAfterDisabling = await enabledSwitchAfterDisabling.getAttribute(
          'aria-checked'
        );
        expect(isCheckedAfterDisabling).to.eql('false');
      });

      it('shouldnt allow you to mute a disabled alert', async () => {
        const disabledEnableSwitch = await testSubjects.find('enableSwitch');
        expect(await disabledEnableSwitch.getAttribute('aria-checked')).to.eql('false');

        const muteSwitch = await testSubjects.find('muteSwitch');
        expect(await muteSwitch.getAttribute('aria-checked')).to.eql('false');

        await muteSwitch.click();

        const muteSwitchAfterTryingToMute = await testSubjects.find('muteSwitch');
        const isDisabledMuteAfterDisabling = await muteSwitchAfterTryingToMute.getAttribute(
          'aria-checked'
        );
        expect(isDisabledMuteAfterDisabling).to.eql('false');
      });

      it('should reenable a disabled the alert', async () => {
        const enableSwitch = await testSubjects.find('enableSwitch');

        const isChecked = await enableSwitch.getAttribute('aria-checked');
        expect(isChecked).to.eql('false');

        await enableSwitch.click();

        const enabledSwitchAfterReenabling = await testSubjects.find('enableSwitch');
        const isCheckedAfterDisabling = await enabledSwitchAfterReenabling.getAttribute(
          'aria-checked'
        );
        expect(isCheckedAfterDisabling).to.eql('true');
      });

      it('should mute the alert', async () => {
        const muteSwitch = await testSubjects.find('muteSwitch');

        const isChecked = await muteSwitch.getAttribute('aria-checked');
        expect(isChecked).to.eql('false');

        await muteSwitch.click();

        const muteSwitchAfterDisabling = await testSubjects.find('muteSwitch');
        const isCheckedAfterDisabling = await muteSwitchAfterDisabling.getAttribute('aria-checked');
        expect(isCheckedAfterDisabling).to.eql('true');
      });

      it('should unmute the alert', async () => {
        const muteSwitch = await testSubjects.find('muteSwitch');

        const isChecked = await muteSwitch.getAttribute('aria-checked');
        expect(isChecked).to.eql('true');

        await muteSwitch.click();

        const muteSwitchAfterUnmuting = await testSubjects.find('muteSwitch');
        const isCheckedAfterDisabling = await muteSwitchAfterUnmuting.getAttribute('aria-checked');
        expect(isCheckedAfterDisabling).to.eql('false');
      });
    });

    describe('Alert Instances', function() {
      const testRunUuid = uuid.v4();
      let alert: any;

      before(async () => {
        await pageObjects.common.navigateToApp('triggersActions');

        const actions = await Promise.all([
          alerting.actions.createAction({
            name: `server-log-${testRunUuid}-${0}`,
            actionTypeId: '.server-log',
            config: {},
            secrets: {},
          }),
          alerting.actions.createAction({
            name: `server-log-${testRunUuid}-${1}`,
            actionTypeId: '.server-log',
            config: {},
            secrets: {},
          }),
        ]);

        const instances = [{ id: 'us-central' }, { id: 'us-east' }, { id: 'us-west' }];
        alert = await alerting.alerts.createAlwaysFiringWithActions(
          `test-alert-${testRunUuid}`,
          actions.map(action => ({
            id: action.id,
            group: 'default',
            params: {
              message: 'from alert 1s',
              level: 'warn',
            },
          })),
          {
            instances,
          }
        );

        // refresh to see alert
        await browser.refresh();

        await pageObjects.header.waitUntilLoadingHasFinished();

        // Verify content
        await testSubjects.existOrFail('alertsList');

        // click on first alert
        await pageObjects.triggersActionsUI.clickOnAlertInAlertsList(alert.name);

        // await first run to complete so we have an initial state
        await retry.try(async () => {
          const { alertInstances } = await alerting.alerts.getAlertState(alert.id);
          expect(Object.keys(alertInstances).length).to.eql(instances.length);
        });
      });

      it.skip('renders the active alert instances', async () => {
        const testBeganAt = moment().utc();

        // Verify content
        await testSubjects.existOrFail('alertInstancesList');

        const { alertInstances } = await alerting.alerts.getAlertState(alert.id);

        const dateOnAllInstances = mapValues(
          alertInstances,
          ({
            meta: {
              lastScheduledActions: { date },
            },
          }) => moment(date).utc()
        );

        const instancesList = await pageObjects.alertDetailsUI.getAlertInstancesList();
        expect(instancesList.map(instance => omit(instance, 'duration'))).to.eql([
          {
            instance: 'us-central',
            status: 'Active',
            start: dateOnAllInstances['us-central'].format('D MMM YYYY @ HH:mm:ss'),
          },
          {
            instance: 'us-east',
            status: 'Active',
            start: dateOnAllInstances['us-east'].format('D MMM YYYY @ HH:mm:ss'),
          },
          {
            instance: 'us-west',
            status: 'Active',
            start: dateOnAllInstances['us-west'].format('D MMM YYYY @ HH:mm:ss'),
          },
        ]);

        const durationFromInstanceTillPageLoad = mapValues(dateOnAllInstances, date =>
          moment.duration(testBeganAt.diff(moment(date).utc()))
        );
        instancesList
          .map(alertInstance => ({
            id: alertInstance.instance,
            duration: alertInstance.duration.split(':').map(part => parseInt(part, 10)),
          }))
          .map(({ id, duration: [hours, minutes, seconds] }) => ({
            id,
            duration: moment.duration({
              hours,
              minutes,
              seconds,
            }),
          }))
          .forEach(({ id, duration }) => {
            // make sure the duration is within a 10 second range which is
            // good enough as the alert interval is 1m, so we know it is a fresh value
            expect(duration.as('milliseconds')).to.greaterThan(
              durationFromInstanceTillPageLoad[id].subtract(1000 * 10).as('milliseconds')
            );
            expect(duration.as('milliseconds')).to.lessThan(
              durationFromInstanceTillPageLoad[id].add(1000 * 10).as('milliseconds')
            );
          });
      });

      it('renders the muted inactive alert instances', async () => {
        // mute an alert instance that doesn't exist
        await alerting.alerts.muteAlertInstance(alert.id, 'eu-east');

        // refresh to see alert
        await browser.refresh();

        const instancesList = await pageObjects.alertDetailsUI.getAlertInstancesList();
        expect(instancesList.filter(alertInstance => alertInstance.instance === 'eu-east')).to.eql([
          {
            instance: 'eu-east',
            status: 'Inactive',
            start: '',
            duration: '',
          },
        ]);
      });

      it('allows the user to mute a specific instance', async () => {
        // Verify content
        await testSubjects.existOrFail('alertInstancesList');

        log.debug(`Ensuring us-central is not muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('us-central', false);

        log.debug(`Muting us-central`);
        await pageObjects.alertDetailsUI.clickAlertInstanceMuteButton('us-central');

        log.debug(`Ensuring us-central is muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('us-central', true);
      });

      it('allows the user to unmute a specific instance', async () => {
        // Verify content
        await testSubjects.existOrFail('alertInstancesList');

        log.debug(`Ensuring us-east is not muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('us-east', false);

        log.debug(`Muting us-east`);
        await pageObjects.alertDetailsUI.clickAlertInstanceMuteButton('us-east');

        log.debug(`Ensuring us-east is muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('us-east', true);

        log.debug(`Unmuting us-east`);
        await pageObjects.alertDetailsUI.clickAlertInstanceMuteButton('us-east');

        log.debug(`Ensuring us-east is not muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('us-east', false);
      });

      it('allows the user unmute an inactive instance', async () => {
        log.debug(`Ensuring eu-east is muted`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceMute('eu-east', true);

        log.debug(`Unmuting eu-east`);
        await pageObjects.alertDetailsUI.clickAlertInstanceMuteButton('eu-east');

        log.debug(`Ensuring eu-east is removed from list`);
        await pageObjects.alertDetailsUI.ensureAlertInstanceExistance('eu-east', false);
      });
    });
  });
};
