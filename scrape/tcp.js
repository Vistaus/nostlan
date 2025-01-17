const dl = require('./dl.js');
const Fuse = require('fuse.js');
let regions = {
	ps2: {
		A: 'as', // Asia
		E: 'eu', // Europe
		J: 'jp', // Japan
		P: 'jp', // Japan (PS1/PS2)
		U: 'us' // USA
	},
	nes: {
		Europe: 'eu',
		Germany: 'de',
		Japan: 'jp',
		USA: 'us'
	}
};
regions.ps3 = regions.ps2;
regions.ps4 = regions.ps2;
regions.n64 = regions.nes;
let tcp = {};

class TheCoverProjectScraper {
	constructor() {
		this.name = 'The Cover Project';
	}

	wrapUrl(url) {
		return url.replace(/http:\/\/www\.thecoverproject\.net\/download_cover\.php\?src=cdn&cover_id=(\d+)\.jpg/, 'c $1');
	}

	unwrapUrl(data) {
		return `http://www.thecoverproject.net/download_cover.php?src=cdn&cover_id=${data[0]}.jpg`;
	}

	async getImgUrls(game, name) {
		if (!browser) {
			er('browser not loaded');
			return;
		}
		let $page, url, res, ext;
		url = await this.getGameUrl(game);
		if (!url) {
			log('game not found on The Cover Project');
			return;
		}
		log(url);
		if (!$page) $page = await browser.goTo(url);
		if (!$page) $page = await browser.goTo(url);
		if (!$page) $page = await browser.goTo(url);
		if (!$page) return;
		let region;
		if (sys == 'ps2') region = game.id[2];
		if (sys == 'nes') region = game.id.split('-')[1];
		if (regions[sys]) {
			region = regions[sys][region] || 'us';
		} else {
			region = 'us';
		}
		// search for the image from the region
		let $links = $page.find('#covers a');
		let found = false;
		for (let i = 0; i < $links.length; i++) {
			let flag = $links.eq(i).find('img').eq(0).attr('src');
			if (!flag) return;
			flag = flag.split('/');
			flag = flag[flag.length - 1].slice(0, 2);
			if (flag == region) {
				if (i != 0) $page = null;
				let href = $links.eq(i).attr('href');
				if (href.slice(0, 4) != 'http') {
					href = 'http://www.thecoverproject.net/' + href;
				}
				log(href);
				if (!$page) {
					$page = await browser.goTo(href);
				}
				if (!$page) {
					$page = await browser.goTo(href);
				}
				if (!$page) {
					$page = await browser.goTo(href);
				}
				if (!$page) return;
				found = true;
				break;
			}
		}
		if (!found && region == 'jp') return;
		url = $page.find('.pageBody h2 a').eq(0).attr('href');
		if (!url) return;
		let img = {};
		url = 'http://www.thecoverproject.net' + url + '.jpg';
		log(url);
		if (arg.dl) {
			await dl(url,
				`${__root}/dev/img/${game.id}/${name}.jpg`);
		}
		img[name] = this.wrapUrl(url);
		return img;
	}

	async getGameUrl(game) {
		if (!browser) {
			er('browser not loaded');
			return;
		}
		// the cover project has "The" appended to titles
		let title = game.title;
		if (/, The/.test(title)) {
			title = game.title.replace(/, The/g, '') + ', The';
		}
		if (/^The/.test(title)) {
			title = game.title.replace(/^The /g, '') + ', The';
		}
		let idx = title[0].toLowerCase();
		if (idx == idx.toUpperCase()) idx = '9';

		let lcTitle = title.toLowerCase();
		let res = tcp[sys][idx].find(x => x.title.toLowerCase() == lcTitle);
		if (!res && /, the/.test(lcTitle)) {
			lcTitle = lcTitle.replace(/, the/g, '');
			res = tcp[sys][idx].find(x => x.title.toLowerCase() == lcTitle);
		}
		if (!res && /&/.test(lcTitle)) {
			lcTitle = lcTitle.replace(/&/g, 'and');
			res = tcp[sys][idx].find(x => x.title.toLowerCase() == lcTitle);
		}

		let results;
		if (res) {
			log(res);
		} else {
			let fusePrms = {
				shouldSort: true,
				tokenize: true,
				matchAllTokens: true,
				includeScore: true,
				threshold: 0.1,
				location: 0,
				distance: 5,
				maxPatternLength: 64,
				minMatchCharLength: 1,
				keys: [
					"title"
				]
			};
			let fuse = new Fuse(tcp[sys][idx], fusePrms);
			results = fuse.search(title.slice(0, 64));
			log(results);

			if (!results && !results.length && /&/.test(title)) {
				title = title.replace(/&/g, 'and');
				results = fuse.search(title.slice(0, 64));
			}
		}

		if (results && results.length) {
			res = results[0].item;
		}

		let url;
		if (res) {
			url = 'http://www.thecoverproject.net/view.php?game_id=';
			url += res.url;
		}
		if (!url && sys == 'wii') {
			if (game.id.length > 4) {
				url = await this.getGameUrl('gcn', game);
				if (url) game.sys = 'gcn';
			} else {
				url = await this.getGameUrl('n64', game);
				if (url) game.sys = 'n64';
				if (!url) {
					url = await this.getGameUrl('snes', game);
					if (url) game.sys = 'snes';
				}
				if (!url) {
					url = await this.getGameUrl('nes', game);
					if (url) game.sys = 'nes';
				}
			}
		}
		return url;
	}

	async load() {
		if (tcp[sys]) {
			return;
		}
		let tcpPath = __root + `/scrape/tcp/${sys}Tcp.json`;
		if (await fs.exists(tcpPath)) {
			tcp[sys] = JSON.parse(await fs.readFile(tcpPath));
			return;
		}
		tcp[sys] = {};

		let catID;

		if (sys == 'gba') catID = 13;
		if (sys == 'n64') catID = 4;
		if (sys == 'nes') catID = 27;
		if (sys == 'ps2') catID = 6;
		if (sys == 'snes') catID = 8;
		if (!catID) {
			er('no category id for system: ' + sys);
			await delay(100000000);
			return;
		}
		let urlBase = `http://www.thecoverproject.net/view.php?cat_id=${catID}&view=`;
		let url;
		for (let idx of "9abcdefghijklmnopqrstuvwxyz") {
			log('indexing ' + idx + ' for system ' + sys);
			let links = [];
			url = urlBase + idx;
			let _url = url;
			for (let page = 1; true; page++) {
				if (page != 1) url = _url + '&page=' + page;
				log(url);
				let $elems;
				if (!$elems) $elems = await browser.goTo(url);
				if (!$elems) $elems = await browser.goTo(url);
				if (!$elems) $elems = await browser.goTo(url);
				if (!$elems) return;
				$elems = $elems.find('.pageBody a');
				if (!$elems.length) break;
				for (let i = 0; i < $elems.length; i++) {
					let id = $elems.eq(i).attr('href').split('=');
					id = id[id.length - 1];
					links.push({
						title: $elems.eq(i).text(),
						url: id
					});
				}
				log($elems.length + ' games on page');
			}
			tcp[sys][idx] = links;
			log(links);
		}
		await fs.outputFile(tcpPath, JSON.stringify(tcp[sys]));
	}
}

module.exports = new TheCoverProjectScraper();
