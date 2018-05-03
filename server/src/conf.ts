export interface MyConfiguration {
	database: {
		port: number,
		user: string,
		host: string,
		pass: string
	};
	path: string;
}

export const Configuration: MyConfiguration = {
	database: {
		port: 33389,
		user: 'em',
		pass: 'alongpassword2016',
		host: '192.168.45.10'
	},
	path: __dirname
};