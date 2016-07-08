define(
	[
		'bassc/core',
		'bassc/meta',
		'bassc/pu',
		'load/pegjs!grammar/bc',
	],
function(BC, meta, BCPU, parser) {
	return {
		load: function (name, parentRequire, onload, config) {
			var fullName = 'bc/' + name + '.bc';
			require(['load/source!' + fullName], function(src) {
				var source = src.source;
				var ast = BCPU.run('parsing ' + name, source, s => parser.parse(s, {BCPU, moduleName: name}));
				require(ast.getIncludes().map(i => 'load/bcmeta!' + i.name), function() {
					var mm = ast.toMeta(meta);
					onload(mm);
				});
			});
		},
	};
});