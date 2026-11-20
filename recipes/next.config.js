/** @type {import('next').NextConfig} */
// מזהה הגרסה — הטלוויזיה משווה אותו לגרסה שבאתר ומתרעננת לבד כשיש עדכון
const BUILD = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now());
module.exports = { reactStrictMode: true, env: { NEXT_PUBLIC_BUILD: BUILD } };
