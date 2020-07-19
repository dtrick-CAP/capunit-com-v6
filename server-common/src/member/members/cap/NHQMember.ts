import { Schema } from '@mysql/xdevapi';
import {
	AccountObject,
	always,
	AsyncEither,
	AsyncIter,
	asyncRight,
	CAPAccountObject,
	CAPExtraMemberInformation,
	CAPMemberContact,
	CAPMemberContactType,
	CAPNHQMemberObject,
	CAPNHQMemberReference,
	collectGenerator,
	EitherObj,
	errorGenerator,
	get as getProp,
	getMemberName,
	getORGIDsFromCAPAccount,
	iterFilter,
	iterMap,
	Maybe,
	NHQ,
	RawTeamObject,
	ServerConfiguration,
	ServerError,
	ShortCAPUnitDutyPosition,
	ShortDutyPosition,
	stripProp,
} from 'common-lib';
import { createWriteStream } from 'fs';
import { get } from 'https';
import { DateTime } from 'luxon';
import { join } from 'path';
import { loadExtraCAPMemberInformation } from '.';
import { AccountGetter } from '../../../Account';
import { collectResults, findAndBindC } from '../../../MySQLUtil';

const getCAPWATCHContactForMember = (schema: Schema) => (id: number) =>
	asyncRight(
		schema.getCollection<NHQ.MbrContact>('NHQ_MbrContact'),
		errorGenerator('Could not get member contact information')
	)
		.map(
			findAndBindC<NHQ.MbrContact>({ CAPID: id })
		)
		.map(collectResults)
		.map(capwatchContact => {
			const memberContact: CAPMemberContact = {
				ALPHAPAGER: {},
				ASSISTANT: {},
				CADETPARENTEMAIL: {},
				CADETPARENTPHONE: {},
				CELLPHONE: {},
				DIGITALPAGER: {},
				EMAIL: {},
				HOMEFAX: {},
				HOMEPHONE: {},
				INSTANTMESSENGER: {},
				ISDN: {},
				RADIO: {},
				TELEX: {},
				WORKFAX: {},
				WORKPHONE: {},
			};

			capwatchContact.forEach(val => {
				if ((val.Type as string) !== '' && (val.Type as string) !== '--Select Type--') {
					memberContact[val.Type.toUpperCase().replace(/ /g, '') as CAPMemberContactType][
						val.Priority
					] = val.Contact;
				}
			});

			return memberContact;
		});

const getNHQDutyPositions = (schema: Schema) => (orgids: number[]) => (
	CAPID: number
): AsyncEither<ServerError, ShortDutyPosition[]> =>
	asyncRight(
		Promise.all([
			collectResults(
				schema
					.getCollection<NHQ.DutyPosition>('NHQ_DutyPosition')
					.find('CAPID = :CAPID')
					.bind('CAPID', CAPID)
			),
			collectResults(
				schema
					.getCollection<NHQ.CadetDutyPosition>('NHQ_CadetDutyPosition')
					.find('CAPID = :CAPID')
					.bind('CAPID', CAPID)
			),
		]),
		errorGenerator('Could not get duty positions')
	)
		.map(([duties, cadetDuties]) => [...duties, ...cadetDuties])
		.map(
			iterMap(item => ({
				duty: item.Duty,
				date: +DateTime.fromISO(item.DateMod),
				orgid: item.ORGID,
				type: 'NHQ' as const,
			}))
		)
		.map(iterFilter(item => orgids.includes(item.orgid)))
		.map(collectGenerator);

const getNHQMemberRows = (schema: Schema) => (CAPID: number) =>
	asyncRight(
		schema.getCollection<NHQ.NHQMember>('NHQ_Member'),
		errorGenerator('Could not get member information')
	)
		.map(
			findAndBindC<NHQ.NHQMember>({ CAPID })
		)
		.map(collectResults)
		.filter(results => results.length === 1, {
			message: 'Could not find member',
			code: 404,
			type: 'OTHER',
		})
		.map(results => results[0])
		.map(stripProp('_id'));

export const expandNHQMember = (schema: Schema) => (account: AccountObject) => (
	teamObjects?: RawTeamObject[]
) => (info: NHQ.NHQMember) =>
	asyncRight(info.CAPID, errorGenerator('Could not get member information'))
		.flatMap(id =>
			AsyncEither.All([
				// getCAPWATCHContactForMember(schema)(id),
				asyncRight({} as CAPMemberContact, errorGenerator('Could not get contact')),
				// Maybe.orSome<AsyncEither<ServerError, ShortDutyPosition[]>>(
				// 	asyncRight(
				// 		[] as ShortDutyPosition[],
				// 		errorGenerator('Could not get duty positions')
				// 	)
				// )(
				// 	Maybe.map((orgids: number[]) => getNHQDutyPositions(schema)(orgids)(id))(
				// 		getORGIDsFromCAPAccount(account)
				// 	)
				// ),
				asyncRight(
					[] as ShortDutyPosition[],
					errorGenerator('Could not get duty positions')
				),
				// loadExtraCAPMemberInformation(schema)(account)({
				// 	id,
				// 	type: 'CAPNHQMember',
				// })(teamObjects),
				asyncRight(
					{} as CAPExtraMemberInformation,
					errorGenerator('Could not get duty positions')
				),
			])
		)
		.map<CAPNHQMemberObject>(([contact, dutyPositions, extraInformation]) => ({
			absenteeInformation: extraInformation.absentee,
			contact,
			dateOfBirth: +DateTime.fromISO(info.DOB),
			dutyPositions: [
				...dutyPositions,
				...extraInformation.temporaryDutyPositions.map(
					item =>
						({
							date: item.assigned,
							duty: item.Duty,
							expires: item.validUntil,
							type: 'CAPUnit',
						} as ShortDutyPosition)
				),
			],
			expirationDate: +DateTime.fromISO(info.Expiration),
			flight: extraInformation.flight,
			id: info.CAPID,
			memberRank: info.Rank,
			nameFirst: info.NameFirst,
			nameLast: info.NameLast,
			nameMiddle: info.NameMiddle,
			nameSuffix: info.NameSuffix,
			orgid: info.ORGID,
			seniorMember: info.Type !== 'CADET',
			squadron: `${info.Region}-${info.Wing}-${info.Unit}`,
			type: 'CAPNHQMember',
			usrID: info.UsrID,
			teamIDs: extraInformation.teamIDs,
		}));

export const getNHQMember = (schema: Schema) => (account: AccountObject) => (
	teamObjects?: RawTeamObject[]
) => (CAPID: number) =>
	asyncRight(CAPID, errorGenerator('Could not get member information'))
		.flatMap(id =>
			AsyncEither.All([
				getNHQMemberRows(schema)(id),
				getCAPWATCHContactForMember(schema)(id),
				Maybe.orSome<AsyncEither<ServerError, ShortDutyPosition[]>>(
					asyncRight(
						[] as ShortDutyPosition[],
						errorGenerator('Could not get duty positions')
					)
				)(
					Maybe.map((orgids: number[]) => getNHQDutyPositions(schema)(orgids)(id))(
						getORGIDsFromCAPAccount(account)
					)
				),
				loadExtraCAPMemberInformation(schema)(account)({
					id,
					type: 'CAPNHQMember',
				})(teamObjects),
			])
		)
		.map<CAPNHQMemberObject>(([info, contact, dutyPositions, extraInformation]) => ({
			absenteeInformation: extraInformation.absentee,
			contact,
			dateOfBirth: +DateTime.fromISO(info.DOB),
			dutyPositions: [
				...dutyPositions,
				...extraInformation.temporaryDutyPositions.map(
					item =>
						({
							date: item.assigned,
							duty: item.Duty,
							expires: item.validUntil,
							type: 'CAPUnit',
						} as ShortDutyPosition)
				),
			],
			expirationDate: +DateTime.fromISO(info.Expiration),
			flight: extraInformation.flight,
			id: info.CAPID,
			memberRank: info.Rank,
			nameFirst: info.NameFirst,
			nameLast: info.NameLast,
			nameMiddle: info.NameMiddle,
			nameSuffix: info.NameSuffix,
			orgid: info.ORGID,
			seniorMember: info.Type !== 'CADET',
			squadron: `${info.Region}-${info.Wing}-${info.Unit}`,
			type: 'CAPNHQMember',
			usrID: info.UsrID,
			teamIDs: extraInformation.teamIDs,
		}));

export const getExtraInformationFromCAPNHQMember = (account: AccountObject) => (
	member: CAPNHQMemberObject
): CAPExtraMemberInformation => ({
	absentee: member.absenteeInformation,
	accountID: account.id,
	flight: member.flight,
	member: {
		type: 'CAPNHQMember',
		id: member.id,
	},
	teamIDs: [],
	temporaryDutyPositions: member.dutyPositions
		.filter((v): v is ShortCAPUnitDutyPosition => v.type === 'CAPUnit')
		.map(({ date, duty, expires }) => ({
			Duty: duty,
			assigned: date,
			validUntil: expires,
		})),
});

export const getNameForCAPNHQMember = (schema: Schema) => (reference: CAPNHQMemberReference) =>
	getNHQMemberRows(schema)(reference.id).map(
		result =>
			`${result.Rank} ${getMemberName({
				nameFirst: result.NameFirst,
				nameMiddle: result.NameMiddle,
				nameLast: result.NameLast,
				nameSuffix: result.NameSuffix,
			})}`
	);

export const getNHQHomeAccountsFunc = (accountGetter: AccountGetter) => (schema: Schema) => (
	member: CAPNHQMemberObject
): AsyncIter<EitherObj<ServerError, CAPAccountObject>> => accountGetter.byOrgid(schema)(member.id);

export const getBirthday = (schema: Schema) => (member: CAPNHQMemberReference) =>
	getNHQMemberRows(schema)(member.id).map(getProp('DOB')).map(DateTime.fromISO);

export const downloadCAPWATCHFile = (conf: ServerConfiguration) => (
	orgid: number,
	capid: number,
	password: string
) => {
	const today = new Date();
	const fileName = join(
		conf.CAPWATCH_DOWNLOAD_PATH,
		`CAPWATCH-${capid}-${orgid}-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}.zip`
	);

	const encodedAuth = Buffer.from(`${capid}:${password}`, 'ascii').toString('base64');
	const url = `https://www.capnhq.gov/CAP.CapWatchAPI.Web/api/cw?unitOnly=0&ORGID=${orgid}`;

	const storageLocation = createWriteStream(fileName);

	return asyncRight(
		new Promise((res, rej) => {
			get(
				url,
				{
					headers: {
						authorization: `Basic ${encodedAuth}`,
					},
				},
				result => {
					if (!result.statusCode || result.statusCode >= 299) {
						return rej(
							new Error(
								'Member could not download CAPWATCH file: ' + result.statusCode
							)
						);
					}

					result.pipe(storageLocation);

					result.on('end', () => {
						res();
					});

					result.on('error', err => {
						rej(err);
					});

					storageLocation.on('error', err => {
						rej(err);
					});
				}
			);
		}),
		errorGenerator('Could not download CAPWATCH file')
	).map(always(fileName));
};
