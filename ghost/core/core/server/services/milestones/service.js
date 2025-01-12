const DomainEvents = require('@tryghost/domain-events');
const logging = require('@tryghost/logging');

const JOB_TIMEOUT = 1000 * 60 * 60 * 24 * (Math.floor(Math.random() * 4)); // 0 - 4 days;

const getStripeLiveEnabled = () => {
    const settingsCache = require('../../../shared/settings-cache');
    const stripeConnect = settingsCache.get('stripe_connect_publishable_key');
    const stripeKey = settingsCache.get('stripe_publishable_key');

    const stripeLiveRegex = /pk_live_/;

    if (stripeConnect && stripeConnect.match(stripeLiveRegex)) {
        return true;
    } else if (stripeKey && stripeKey.match(stripeLiveRegex)) {
        return true;
    }

    return false;
};

module.exports = {
    /** @type {import('@tryghost/milestones/lib/MilestonesService')} */
    api: null,

    /**
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.api) {
            const db = require('../../data/db');
            const MilestoneQueries = require('./MilestoneQueries');

            const {
                MilestonesService,
                InMemoryMilestoneRepository
            } = require('@tryghost/milestones');
            const config = require('../../../shared/config');
            const milestonesConfig = config.get('milestones');

            const repository = new InMemoryMilestoneRepository({DomainEvents});
            const queries = new MilestoneQueries({db});

            this.api = new MilestonesService({
                repository,
                milestonesConfig, // avoid using getters and pass as JSON
                queries
            });
        }
    },

    /**
     * @returns {Promise<object>}
     */
    async run() {
        const labs = require('../../../shared/labs');

        if (labs.isSet('milestoneEmails')) {
            const members = await this.api.checkMilestones('members');
            let arr;
            const stripeLiveEnabled = getStripeLiveEnabled();

            if (stripeLiveEnabled) {
                arr = await this.api.checkMilestones('arr');
            }

            return {
                members,
                arr
            };
        }
    },

    /**
     *
     * @param {number} [customTimeout]
     *
     *  @returns {Promise<object>}
     */
    async scheduleRun(customTimeout) {
        const timeOut = customTimeout || JOB_TIMEOUT;

        const today = new Date();
        const msNow = today.getMilliseconds();
        const newMs = msNow + timeOut;
        const jobDate = today.setMilliseconds(newMs);

        logging.info(`Running milestone emails job on ${new Date(jobDate).toString()}`);

        return new Promise((resolve) => {
            setTimeout(async () => {
                const result = await this.run();
                return resolve(result);
            }, timeOut);
        });
    },

    /**
     * @param {number} [customTimeout]
     * Only used temporary for testing purposes.
     * Will be removed, after job scheduling implementation.
     *
     * @returns {Promise<object>}
     */
    async initAndRun(customTimeout) {
        await this.init();

        return this.scheduleRun(customTimeout);
    }
};
