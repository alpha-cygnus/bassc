define(
function() {
	return {
		load: function (name, parentRequire, onload, config) {
			var fullName = name;
			var path = parentRequire.toUrl(fullName);
			$.ajax({
				url: path,
				dataType: 'text',
				success: function(source) {
					onload({success: true, source});
				},
				error: function(xhr, status, error) {
					onload({success: false, status, error});
				},
			});
		},
	};
});