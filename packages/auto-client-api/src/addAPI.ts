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

import * as ts from 'typescript';
import { getBooleanLiteralFromType, getStringLiteralFromType, getTypeNodeForSymbol } from './util';
import { createValidator } from './validator';

export default (node: ts.CallExpression, typeChecker: ts.TypeChecker) => {
	const typeArgument = node.typeArguments?.[0];
	const validatorArgument = node.arguments[0];
	const adderArgument = node.arguments[1];
	const endpointArgument = node.arguments[2];

	let type;

	if (!typeArgument) {
		const alternateTypeArgument = ts.isCallExpression(adderArgument)
			? adderArgument.typeArguments
				? typeChecker.getTypeAtLocation(adderArgument.typeArguments[0])
				: undefined
			: undefined;

		type =
			typeChecker.getTypeAtLocation(endpointArgument).aliasTypeArguments?.[0] ??
			alternateTypeArgument;

		// typeArgument = typeArgument ??
	} else {
		type = typeChecker.getTypeFromTypeNode(typeArgument);
	}

	if (!type || !validatorArgument || !adderArgument || !endpointArgument) {
		return node;
	}

	const properties = type.getProperties();
	const callSignatures = type.getCallSignatures();

	const bodyType = getTypeNodeForSymbol(callSignatures[0]?.parameters?.[1]);
	const url = getStringLiteralFromType(properties.find(sym => sym.name === 'url'));
	const method = getStringLiteralFromType(properties.find(sym => sym.name === 'method'));
	const requiresMember = getStringLiteralFromType(
		properties.find(sym => sym.name === 'requiresMember')
	);
	const needsToken = getBooleanLiteralFromType(properties.find(sym => sym.name === 'needsToken'));
	const usesValidator = getBooleanLiteralFromType(
		properties.find(sym => sym.name === 'useValidator')
	);

	if (
		bodyType === undefined ||
		url === undefined ||
		method === undefined ||
		requiresMember === undefined ||
		needsToken === undefined ||
		usesValidator === undefined
	) {
		console.error('Could not find required properties for addAPI<T>', typeArgument);

		return node;
	}

	return ts.createCall(
		ts.createCall(adderArgument, undefined, [
			ts.createLiteral(url),
			ts.createLiteral(method),
			ts.createLiteral(requiresMember),
			ts.createLiteral(needsToken),
			ts.createLiteral(usesValidator),
			usesValidator
				? createValidator(node, validatorArgument, typeChecker)(bodyType)
				: ts.createNew(validatorArgument, [], [ts.createObjectLiteral([])])
		]),
		undefined,
		[endpointArgument]
	);
};
