/**
 * Copyright (C) 2020 Andrew Rioux
 *
 * This file is part of CAPUnit.com.
 *
 * CAPUnit.com is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * CAPUnit.com is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with CAPUnit.com.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Schema } from '@mysql/xdevapi';
import { DiscordAccount, MemberReference, Maybe } from 'common-lib';
import { findAndBind, collectResults } from 'server-common';

export default (schema: Schema) => async (member: MemberReference) => {
	const collection = schema.getCollection<DiscordAccount>('DiscordAccounts');

	const results = await collectResults(findAndBind(collection, { member }));

	if (results.length !== 1) {
		return Maybe.none();
	}

	return Maybe.some(results[0]);
};
