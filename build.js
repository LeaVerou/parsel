const { readFile, writeFile } = require("fs").promises;

(async () => {

let data = await readFile("./parsel.js", {encoding: 'utf8'});
let names = [];

data = data.replace(/export function (\w+)/g, ($0, name) => {
	names.push(name);
	return "function " + name;
});

let contents = `var parsel = (() => {
${data}

return {${names.join(", ")}};
})();`;

await writeFile("./parsel_nomodule.js", contents, {encoding: 'utf8'});

})();
