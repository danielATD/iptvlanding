/**
 * FlowTV Catalog Extractor
 * Extracts all movies, series, and channels from the Xtream Codes API
 * Run with: node extract_catalog.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// API Configuration (from Fiddler capture)
const API_BASE = 'http://enlatv.com:8080/player_api.php';
const USERNAME = 'flow01';
const PASSWORD = 'caracoles';

function buildUrl(action, extra = '') {
    return `${API_BASE}?username=${USERNAME}&password=${PASSWORD}&action=${action}${extra}`;
}

function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        console.log(`  → Fetching: ${url.replace(PASSWORD, '***')}`);
        http.get(url, { timeout: 60000 }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON: ${e.message}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

async function main() {
    const outputDir = path.join(__dirname, 'catalog_data');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log('🎬 FlowTV Catalog Extractor');
    console.log('===========================\n');

    // 1. Get VOD (Movies) Categories
    console.log('📂 Fetching movie categories...');
    try {
        const vodCategories = await fetchJSON(buildUrl('get_vod_categories'));
        fs.writeFileSync(path.join(outputDir, 'vod_categories.json'), JSON.stringify(vodCategories, null, 2));
        console.log(`   ✅ ${vodCategories.length} movie categories\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    // 2. Get ALL Movies
    console.log('🎬 Fetching ALL movies (this may take a moment)...');
    try {
        const movies = await fetchJSON(buildUrl('get_vod_streams'));
        fs.writeFileSync(path.join(outputDir, 'movies_full.json'), JSON.stringify(movies, null, 2));
        
        // Create a simplified version for the search page
        const moviesSimple = movies.map(m => ({
            id: m.stream_id || m.num,
            name: m.name,
            year: m.year || '',
            rating: m.rating || '',
            genre: m.genre || m.category_name || '',
            poster: m.stream_icon || m.cover || '',
            plot: m.plot || '',
            cast: m.cast || '',
            director: m.director || '',
            added: m.added || '',
            category_id: m.category_id || ''
        }));
        fs.writeFileSync(path.join(outputDir, 'movies.json'), JSON.stringify(moviesSimple, null, 2));
        console.log(`   ✅ ${movies.length} movies extracted\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    // 3. Get Series Categories
    console.log('📂 Fetching series categories...');
    try {
        const seriesCategories = await fetchJSON(buildUrl('get_series_categories'));
        fs.writeFileSync(path.join(outputDir, 'series_categories.json'), JSON.stringify(seriesCategories, null, 2));
        console.log(`   ✅ ${seriesCategories.length} series categories\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    // 4. Get ALL Series
    console.log('📺 Fetching ALL series...');
    try {
        const series = await fetchJSON(buildUrl('get_series'));
        fs.writeFileSync(path.join(outputDir, 'series_full.json'), JSON.stringify(series, null, 2));
        
        const seriesSimple = series.map(s => ({
            id: s.series_id,
            name: s.name,
            year: s.year || '',
            rating: s.rating || '',
            genre: s.genre || s.category_name || '',
            poster: s.cover || '',
            plot: s.plot || '',
            cast: s.cast || '',
            director: s.director || '',
            category_id: s.category_id || '',
            seasons: s.num || ''
        }));
        fs.writeFileSync(path.join(outputDir, 'series.json'), JSON.stringify(seriesSimple, null, 2));
        console.log(`   ✅ ${series.length} series extracted\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    // 5. Get Live Categories
    console.log('📂 Fetching channel categories...');
    try {
        const liveCategories = await fetchJSON(buildUrl('get_live_categories'));
        fs.writeFileSync(path.join(outputDir, 'live_categories.json'), JSON.stringify(liveCategories, null, 2));
        console.log(`   ✅ ${liveCategories.length} channel categories\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    // 6. Get ALL Live Channels
    console.log('📡 Fetching ALL live channels...');
    try {
        const channels = await fetchJSON(buildUrl('get_live_streams'));
        fs.writeFileSync(path.join(outputDir, 'channels_full.json'), JSON.stringify(channels, null, 2));
        
        const channelsSimple = channels.map(c => ({
            id: c.stream_id || c.num,
            name: c.name,
            icon: c.stream_icon || '',
            category_id: c.category_id || '',
            epg_channel_id: c.epg_channel_id || ''
        }));
        fs.writeFileSync(path.join(outputDir, 'channels.json'), JSON.stringify(channelsSimple, null, 2));
        console.log(`   ✅ ${channels.length} channels extracted\n`);
    } catch (e) {
        console.log(`   ⚠️ Error: ${e.message}\n`);
    }

    console.log('===========================');
    console.log(`📁 Data saved to: ${outputDir}`);
    console.log('✅ Extraction complete!');
}

main().catch(e => {
    console.error('❌ Fatal error:', e.message);
    process.exit(1);
});
