import { Schema } from '@mysql/xdevapi';
import {
	NoSQLDocument,
	NotificationCause,
	NotificationMemberCause,
	NotificationObject,
	NotificationSystemCause
} from 'common-lib';
import { NotificationCauseType, NotificationTargetType } from 'common-lib/index';
import Account from '../Account';
import MemberBase from '../Members';
import { findAndBind, generateResults } from '../MySQLUtil';
import { Notification } from '../Notification';

export default class GlobalNotification extends Notification {
	public static async AccountHasGlobalNotificationActive(
		account: Account,
		schema: Schema
	): Promise<boolean> {
		const notificationCollection = schema.getCollection<NotificationObject>('Notifications');

		const generator = generateResults(
			findAndBind(notificationCollection, {
				accountID: account.id,
				target: {
					type: NotificationTargetType.EVERYONE
				}
			})
		);

		for await (const result of generator) {
			if (
				result.target.type === NotificationTargetType.EVERYONE &&
				result.target.expires > Date.now() &&
				!result.read
			) {
				return true;
			}
		}

		return false;
	}

	public static async GetCurrent(account: Account, schema: Schema): Promise<GlobalNotification> {
		const notificationCollection = schema.getCollection<
			NotificationObject & Required<NoSQLDocument>
		>('Notifications');

		const generator = generateResults(
			findAndBind(notificationCollection, {
				accountID: account.id,
				target: {
					type: NotificationTargetType.EVERYONE
				}
			})
		);

		for await (const result of generator) {
			if (
				result.target.type === NotificationTargetType.EVERYONE &&
				result.target.expires > Date.now() &&
				!result.read
			) {
				return new GlobalNotification(result, account, schema);
			}
		}

		throw new Error('There is not curently an active notification');
	}

	public static async CreateNotification(
		text: string,
		expires: number,
		from: NotificationSystemCause,
		account: Account,
		schema: Schema
	): Promise<GlobalNotification>;
	public static async CreateNotification(
		text: string,
		expires: number,
		from: NotificationMemberCause,
		account: Account,
		schema: Schema,
		fromMember: MemberBase
	): Promise<GlobalNotification>;

	public static async CreateNotification(
		text: string,
		expires: number,
		from: NotificationCause,
		account: Account,
		schema: Schema,
		fromMember?: MemberBase
	) {
		if (await GlobalNotification.AccountHasGlobalNotificationActive(account, schema)) {
			throw new Error('Cannot create a global notification with one active');
		}

		const results = await this.Create(
			{
				cause: from,
				text
			},
			{
				type: NotificationTargetType.EVERYONE,
				accountID: account.id,
				expires
			},
			account,
			schema
		);

		return new GlobalNotification(
			{
				...results,
				toMemberName: null,
				fromMemberName:
					from.type === NotificationCauseType.MEMBER ? fromMember.getFullName() : null
			},
			account,
			schema
		);
	}

	public constructor(
		data: NotificationObject & Required<NoSQLDocument>,
		account: Account,
		schema: Schema
	) {
		super(data, account, schema);
	}
}
