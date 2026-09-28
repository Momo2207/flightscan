import { copyFile, mkdir, rm } from 'node:fs/promises';

// Only the HTML is public. Credentials stay in server environment variables.
const output = new URL('../public/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyFile(new URL('../index.html', import.meta.url), new URL('index.html', output));
console.log('Built public/index.html');
