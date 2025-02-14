'use strict';

const { flags } = require('@oclif/command');
const BoxCommand = require('../../box-command');
const fs = require('fs');
const path = require('path');
const progress = require('cli-progress');
const BoxCLIError = require('../../cli-error');
const utils = require('../../util');

class FilesDownloadCommand extends BoxCommand {
	async run() {
		const { flags, args } = this.parse(FilesDownloadCommand);

		let file = await this.client.files.get(args.id);
		let fileName = file.name;

		let filePath = path.join(flags.destination || this.settings.boxDownloadsFolderPath, fileName);

		/* eslint-disable no-sync */
		if (fs.existsSync(filePath)) {
		/* eslint-enable no-sync */

			let shouldOverwrite = await this.confirm(`File ${filePath} already exists — overwrite?`);

			if (!shouldOverwrite) {
				return;
			}
		}

		let options = {};

		if (flags.version) {
			options.version = flags.version;
		}

		let stream = await this.client.files.getReadStream(args.id, options);
		try {
			let output = fs.createWriteStream(filePath);
			stream.pipe(output);
		} catch (ex) {
			throw new BoxCLIError(`Could not download to destination file ${filePath}`, ex);
		}

		let progressBar = new progress.Bar({
			format: '[{bar}] {percentage}% | ETA: {eta_formatted} | {value}/{total} | Speed: {speed} MB/s',
			stopOnComplete: true,
		});
		let startTime = Date.now();
		progressBar.start(file.size, 0, { speed: 'N/A' });

		let downloadedByte = 0;
		stream.on('data', (chunk) => {
			downloadedByte += chunk.length;
		});
		let intervalUpdate = setInterval(() => {
			progressBar.update(downloadedByte, {
				speed: Math.floor(downloadedByte / (Date.now() - startTime) / 1000),
			});
		}, 1000);

		/* eslint-disable promise/avoid-new */
		// We need to await the end of the stream to avoid a race condition here
		await new Promise((resolve, reject) => {
			stream.on('end', resolve);
			stream.on('error', reject);
		});
		clearInterval(intervalUpdate);
		progressBar.update(downloadedByte);
		this.info(`Downloaded file ${fileName}`);
	}
}

FilesDownloadCommand.description = 'Download a file';
FilesDownloadCommand.examples = ['box files:download 11111 --destination /path/to/destinationFolder'];
FilesDownloadCommand._endpoint = 'get_files_id_content';

FilesDownloadCommand.flags = {
	...BoxCommand.flags,
	version: flags.string({
		description: 'File version ID of the specific file version to download',
	}),
	destination: flags.string({
		description: 'The destination folder to write the file to',
		parse: utils.parsePath,
	}),
};

FilesDownloadCommand.args = [
	{
		name: 'id',
		required: true,
		hidden: false,
		description: 'ID of the file to download'
	}
];

module.exports = FilesDownloadCommand;
