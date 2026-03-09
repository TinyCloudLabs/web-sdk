export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.CsXHeeuZ.js",app:"_app/immutable/entry/app.C0jI1WPc.js",imports:["_app/immutable/entry/start.CsXHeeuZ.js","_app/immutable/chunks/BgVIHwPI.js","_app/immutable/chunks/Cw8bBDSV.js","_app/immutable/chunks/DB9b5SQb.js","_app/immutable/chunks/DUKrAqtd.js","_app/immutable/entry/app.C0jI1WPc.js","_app/immutable/chunks/DUKrAqtd.js","_app/immutable/chunks/DB9b5SQb.js","_app/immutable/chunks/Cw8bBDSV.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
