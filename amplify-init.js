// amplify-init.js — place at project root, next to amplify_outputs.json
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './amplify_outputs.json';
import { installActivityLog } from './activity-log.js';

Amplify.configure(outputs);
export const client = generateClient();
// Every staff change, from any portal, goes to Activity Logs (see activity-log.js)
installActivityLog(client);
