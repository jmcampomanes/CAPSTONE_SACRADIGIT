// amplify-init.js — place at project root, next to amplify_outputs.json
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from './amplify_outputs.json';

Amplify.configure(outputs);
export const client = generateClient();
