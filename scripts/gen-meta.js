const crypto = require('node:crypto');
const fs = require('node:fs');

const fileContents = fs.readFileSync('lib/reading-list.json', 'utf8');
const articles = JSON.parse(fileContents);
const hash = crypto
	.createHash('sha256')
	.update(fileContents)
	.digest('hex')
	.slice(0, 16);

fs.writeFileSync(
	'lib/reading-list-meta.json',
	`${JSON.stringify({ count: articles.length, hash })}\n`,
);
