const fs = require("fs");
const path = require("path");

const rootFolder = path.join(__dirname, "../");
const localesFolder = path.join(rootFolder, "locales");

// 读取 locales 文件夹下的所有文件
fs.readdir(localesFolder, (err, files) => {
	if (err) {
		console.error("Error reading locales folder:", err);
		return;
	}

	// 遍历每个文件
	files.forEach((file) => {
		const filePath = path.join(localesFolder, file);
		const fileExt = path.extname(file);
		const fileName = path.basename(file, fileExt);
		const newFileName = `package.nls${
			fileName == "en" ? "" : "." + fileName.toLowerCase()
		}${fileExt}`;
		const newFilePath = path.join(rootFolder, newFileName);

		// 仅处理 .json 文件
		if (fileExt === ".json") {
			// 读取文件内容
			fs.readFile(filePath, "utf8", (err, data) => {
				if (err) {
					console.error(`Error reading file ${filePath}:`, err);
					return;
				}

				// 写入新文件
				fs.writeFile(newFilePath, data, "utf8", (err) => {
					if (err) {
						console.error(
							`Error writing file ${newFilePath}:`,
							err
						);
						return;
					}

					console.log(
						`File ${file} renamed and moved to ${newFilePath}`
					);
				});
			});
		}
	});
});
