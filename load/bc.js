define(
	[
		'bassc/pu',
		'load/pegjs!grammar/bc',
	],
function(BCPU, parser) {
	// PEG = PEG || window.PEG;
	return {
		load: function (name, parentRequire, onload, config) {
			var fullName = 'bc/' + name + '.bc';
			console.log(parser.parse);
			var path = parentRequire.toUrl(fullName);
			$.get(path, function(source) {
				var ast = BCPU.run('parsing ' + name, source, s => parser.parse(s, {BCPU, moduleName: name}));
				// var parser = PEG.buildParser(grammar);
				onload(ast);
			});
		},
	};
});