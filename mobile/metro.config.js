const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Only the shared data directory is needed outside the mobile project.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../supabase/functions/_shared')];
module.exports = config;
