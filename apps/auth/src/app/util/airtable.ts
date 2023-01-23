import Airtable from 'airtable';
import { AIRTABLE_API_KEY, AIRTABLE_BASE_ID } from '../config/secrets';

interface PipelineSignUpParams {
    Email: string;
    Date: string | Date;
    AcceptUpdates?: boolean;
    [key: string]: any;
}

const formatDate = (datestring: string | Date | number) => {
    const date = new Date(datestring);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};

export default {
    pipelineSignup: async (params: PipelineSignUpParams) => {
        if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) return;

        const base = new Airtable().base(AIRTABLE_BASE_ID);
        await base('Pipeline: Signups').create({
            ...(params as any),
            Date: params.Date ? formatDate(params.Date) : formatDate(Date.now()),
        });
    },
};
