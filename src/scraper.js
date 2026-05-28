const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');

async function scrapeDmmProductDetail(affiliateUrl) {
    let browser;
    try {
        const urlObj = new URL(affiliateUrl);
        let rawUrl = urlObj.searchParams.get('lurl') || affiliateUrl;
        rawUrl = decodeURIComponent(rawUrl);
        
        if (rawUrl.includes('published.fanza.co.jp') || rawUrl.includes('book.fanza.co.jp')) {
            rawUrl = rawUrl.replace('published.fanza.co.jp', 'book.dmm.co.jp').replace('book.fanza.co.jp', 'book.dmm.co.jp');
        }

        console.log(`🔍 本物のブラウザ(Puppeteer)で詳細ページを起動中...`);
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.setCookie(
            { name: 'age_check_done', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'r18', value: '1', domain: '.dmm.co.jp', path: '/' },
            { name: 'g_device', value: 'pc', domain: '.dmm.co.jp', path: '/' }
        );

        await page.goto(rawUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 500;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 6000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await new Promise(resolve => setTimeout(resolve, 3000));
        const rawHtml = await page.content();
        const dom = new JSDOM(rawHtml);
        const doc = dom.window.document;

        let userReviews = [];
        let productDescription = '';
        let realTachiyomiUrl = '';
        
        // 💡修正：作品詳細エリアの全ジャンルタグ（volume-detail-info-genre）を正確に全取得
        let pageGenres = [];
        const genreElements = doc.querySelectorAll('[data-testid="volume-detail-info-genre"]');
        genreElements.forEach(elem => {
            const tagText = elem.textContent.replace('#', '').trim();
            if (tagText && !pageGenres.includes(tagText)) {
                pageGenres.push(tagText);
            }
        });

        // 星評価の抽出
        let reviewRating = '0.0';
        let reviewCount = '0';
        const ratingScoreElem = doc.querySelector('.sc-77ef7150-2'); 
        if (ratingScoreElem) {
            reviewRating = ratingScoreElem.textContent.trim();
        }
        const ratingCountElem = doc.querySelector('.sc-77ef7150-3');
        if (ratingCountElem) {
            reviewCount = ratingCountElem.textContent.replace(/[\(\)]/g, '').trim();
        }

        const descElem = doc.querySelector('[data-testid="description-text"]') || doc.querySelector('.sc-ef68d909-1');
        if (descElem) {
            productDescription = descElem.innerHTML.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
        }

        const nicknames = doc.querySelectorAll('[data-testid="nickname"]');
        nicknames.forEach(nick => {
            const reviewBox = nick.closest('div');
            if (reviewBox && reviewBox.parentElement) {
                const pTxt = reviewBox.parentElement.querySelector('p');
                if (pTxt) {
                    const text = pTxt.textContent.trim().replace(/\s+/g, ' ');
                    if (text && text.length > 5 && !userReviews.includes(text)) {
                        userReviews.push(text);
                    }
                }
            }
        });

        const tachiyomiLinkElem = doc.querySelector('a[href*="/tachiyomi/"]');
        if (tachiyomiLinkElem) {
            realTachiyomiUrl = tachiyomiLinkElem.getAttribute('href');
            if (!realTachiyomiUrl.startsWith('http')) {
                realTachiyomiUrl = 'https://book.dmm.co.jp' + realTachiyomiUrl;
            }
        }

        await browser.close();

        const filteredReviews = userReviews.filter(r => {
            if (r.includes('作品の内容に関する記述が含まれています') || r.includes('ネタバレ')) return false;
            if (r.includes('特定商取引法') || r.includes('ご利用規約') || r.includes('ポイント')) return false;
            if (r.length < 10 || r.length > 400) return false;
            return true;
        });

        return {
            userReviews: filteredReviews.slice(0, 3).join('\n---\n') || '（ネタバレなしレビューなし）',
            productDescription: productDescription || '（作品紹介なし）',
            tachiyomiUrl: realTachiyomiUrl,
            pageGenres: pageGenres,       
            reviewRating: reviewRating,   
            reviewCount: reviewCount      
        };
    } catch (error) {
        if (browser) await browser.close();
        console.error('⚠️ 詳細ページの解析に失敗しました:', error.message);
        return { userReviews: '', productDescription: '', tachiyomiUrl: '', pageGenres: [], reviewRating: '0.0', reviewCount: '0' };
    }
}

module.exports = { scrapeDmmProductDetail };