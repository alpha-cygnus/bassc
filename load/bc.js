define(
function() {
	// PEG = PEG || window.PEG;
	return {
		load: function (name, parentRequire, onload, config) {
			require(['load/bcmeta!' + name], function(mm) {
				var text = mm.compileToSource();
				onload(text);
			});
			// var fullName = 'bc/' + name + '.bc';
			// console.log(parser.parse);
			
			// var path = parentRequire.toUrl(fullName);
			// $.get(path, function(source) {
			// 	var ast = BCPU.run('parsing ' + name, source, s => parser.parse(s, {BCPU, moduleName: name}));
			// 	var src = BCPU.sources[fullName] = {
			// 		source,
			// 		ast,
			// 	};
			// 	// var parser = PEG.buildParser(grammar);
			// 	var deps = ['bassc/pu'].concat();
			// 	require(ast.getIncludes().map(i => 'load/bc!' + i.name), function() {
			// 		var mm = ast.toMeta(meta);
			// 		var text = mm.compileToSource();
			// 		onload(text);
			// 	});
				
			// 	// var text = (`define(['${deps.join("','")}'], function(BC, meta, BCPU) {
			// 	// 	var src = BCPU.sources['${fullName}'];
			// 	// 	return src.;
			// 	// })`);
			// 	// onload.fromText(text);
			// });
		},
	};
});