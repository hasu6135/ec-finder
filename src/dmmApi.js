const axios = require('axios');

async function fetchDmmProducts(apiId, affiliateId, fetchCount) {
    try {
        const finalAffiliateId = affiliateId.endsWith('-001') ? affiliateId.replace('-001', '-990') : affiliateId;
        console.log('📡 DMM APIへリクエストを送信中...');
        
        const response = await axios.get('https://api.dmm.com/affiliate/v3/ItemList', {
            params: {
                api_id: apiId,
                affiliate_id: finalAffiliateId,
                site: 'FANZA',  
                service: 'ebook',
                floor: 'comic',
                keyword: '羞恥', 
                hits: fetchCount,       
                sort: 'rank'             
            }
        });

        if (!response.data.result || !response.data.result.items) return [];

        return response.data.result.items.map(item => {
            const encodedRawUrl = encodeURIComponent(item.URL);
            const perfectAffiliateUrl = `https://al.fanza.co.jp/?lurl=${encodedRawUrl}&af_id=${affiliateId}&ch=search_link&ch_id=link`;
            const officialKeywords = item.iteminfo?.keyword ? item.iteminfo.keyword.map(k => k.name) : [];

            return {
                title: item.title,
                url: perfectAffiliateUrl, 
                imageUrl: item.imageURL?.large || item.imageURL?.list,
                officialKeywords: officialKeywords
            };
        });
    } catch (error) {
        console.error('⚠️ DMM API取得エラー:', error.message);
        return [];
    }
}

module.exports = { fetchDmmProducts };