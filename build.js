const fs = require("fs");

function readFile(file, enc = "utf8") {
	return new Promise((resolve, reject) => {
		fs.readFile(file, enc, (err,data) => {
			if (err) {
				reject(err);
			}

			resolve(data);
		});
	});
}

function writeFile(file, contents, enc) {
	return new Promise((resolve, reject) => {
		fs.writeFile(file, contents, enc, (err) => {
			if (err) {
				reject(err);
			}

			resolve();
		});
	});
}

(async () => {

let data = await readFile("./parsel.js");
let names = [];

data = data.replace(/export function (\w+)/g, ($0, name) => {
	names.push(name);
	return "function " + name;
});

let contents = `var parsel = (() => {
${data}

return {${names.join(", ")}};
})();`;

writeFile("./parsel_nomodule.js", contents);

})();
