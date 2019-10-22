import { Schema } from '@mysql/xdevapi';
import {
	NewNotificationObject,
	NoSQLDocument,
	NotificationAdminTarget,
	NotificationCause,
	NotificationData,
	NotificationEveryoneTarget,
	NotificationMemberTarget,
	NotificationObject,
	NotificationTarget,
	RawNotificationObject
} from 'common-lib';
import { NotificationCauseType, NotificationTargetType } from 'common-lib/index';
import {
	Account,
	AdminNotification,
	collectResults,
	findAndBind,
	generateResults,
	GlobalNotification,
	MemberBase,
	MemberNotification,
	resolveReference
} from './internals';

export abstract class Notification implements NotificationObject {
	public static async Get(
		id: number,
		account: Account,
		schema: Schema
	): Promise<AdminNotification | MemberNotification | GlobalNotification> {
		const notificationCollection = schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		const results = await collectResults(
			findAndBind(notificationCollection, {
				id,
				accountID: account.id
			})
		);

		if (results.length !== 1) {
			throw new Error('Could not get notification');
		}

		let fromMemberName = null;
		if (results[0].cause.type === NotificationCauseType.MEMBER) {
			const fromMember = await resolveReference(results[0].cause.from, account, schema, true);

			fromMemberName = fromMember.getFullName();
		}

		switch (results[0].target.type) {
			case NotificationTargetType.ADMINS:
				return new AdminNotification(
					{
						...results[0],
						fromMemberName,
						toMemberName: null
					},
					account,
					schema
				);

			case NotificationTargetType.MEMBER:
				const toMember = await resolveReference(
					results[0].target.to,
					account,
					schema,
					true
				);

				return new MemberNotification(
					{ ...results[0], toMemberName: toMember.getFullName(), fromMemberName },
					account,
					schema
				);

			case NotificationTargetType.EVERYONE:
				return new GlobalNotification(
					{ ...results[0], fromMemberName, toMemberName: null },
					account,
					schema
				);
		}
	}

	public static async GetOfTarget(
		id: number,
		target: NotificationAdminTarget,
		account: Account,
		schema: Schema
	): Promise<AdminNotification>;
	public static async GetOfTarget(
		id: number,
		target: NotificationMemberTarget,
		account: Account,
		schema: Schema
	): Promise<MemberNotification>;
	public static async GetOfTarget(
		id: number,
		target: NotificationEveryoneTarget,
		account: Account,
		schema: Schema
	): Promise<GlobalNotification>;

	public static async GetOfTarget(
		id: number,
		target: NotificationTarget,
		account: Account,
		schema: Schema
	): Promise<AdminNotification | MemberNotification | GlobalNotification> {
		const notificationCollection = schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		const results = await collectResults(
			findAndBind(notificationCollection, {
				target,
				id,
				accountID: account.id
			})
		);

		if (results.length !== 1) {
			throw new Error('Could not get notification');
		}

		let fromMemberName = null;
		if (results[0].cause.type === NotificationCauseType.MEMBER) {
			const fromMember = await resolveReference(results[0].cause.from, account, schema, true);

			fromMemberName = fromMember.getFullName();
		}

		switch (results[0].target.type) {
			case NotificationTargetType.ADMINS:
				return new AdminNotification(
					{
						...results[0],
						fromMemberName,
						toMemberName: null
					},
					account,
					schema
				);

			case NotificationTargetType.MEMBER:
				const toMember = await resolveReference(
					results[0].target.to,
					account,
					schema,
					true
				);

				return new MemberNotification(
					{ ...results[0], toMemberName: toMember.getFullName(), fromMemberName },
					account,
					schema
				);

			case NotificationTargetType.EVERYONE:
				return new GlobalNotification(
					{ ...results[0], fromMemberName, toMemberName: null },
					account,
					schema
				);
		}
	}

	public static StreamFor(
		target: NotificationAdminTarget,
		account: Account,
		schema: Schema
	): AsyncIterableIterator<AdminNotification>;
	public static StreamFor(
		target: NotificationMemberTarget,
		account: Account,
		schema: Schema
	): AsyncIterableIterator<MemberNotification>;

	public static async *StreamFor(
		target: NotificationTarget,
		account: Account,
		schema: Schema
	): AsyncIterableIterator<AdminNotification | MemberNotification> {
		const notificationCollection = schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		const results = generateResults(
			findAndBind(notificationCollection, {
				target,
				accountID: account.id
			})
		);

		for await (const i of results) {
			let fromMemberName: string | null = null;
			if (i.cause.type === NotificationCauseType.MEMBER) {
				const member = await resolveReference(i.cause.from, account, schema, true);

				fromMemberName = member.getFullName();
			}

			switch (i.target.type) {
				case NotificationTargetType.ADMINS:
					yield new AdminNotification(
						{
							...i,
							toMemberName: null,
							fromMemberName
						},
						account,
						schema
					);
					break;

				case NotificationTargetType.MEMBER:
					const toMember = await resolveReference(i.target.to, account, schema, true);
					yield new MemberNotification(
						{
							...i,
							toMemberName: toMember.getFullName(),
							fromMemberName
						},
						account,
						schema
					);
					break;
			}
		}
	}

	public static async GetFor(
		target: NotificationAdminTarget,
		account: Account,
		schema: Schema
	): Promise<AdminNotification[]>;
	public static async GetFor(
		target: NotificationMemberTarget,
		account: Account,
		schema: Schema
	): Promise<MemberNotification[]>;
	public static async GetFor(
		target: NotificationEveryoneTarget,
		account: Account,
		schema: Schema
	): Promise<GlobalNotification>;

	public static async GetFor(
		target: NotificationTarget,
		account: Account,
		schema: Schema
	): Promise<Array<AdminNotification | MemberNotification> | GlobalNotification> {
		if (target.type === NotificationTargetType.EVERYONE) {
			return GlobalNotification.GetCurrent(account, schema);
		}

		const notificationCollection = schema.getCollection<
			RawNotificationObject & Required<NoSQLDocument>
		>('Notifications');

		const results = await collectResults(
			findAndBind(notificationCollection, {
				target,
				accountID: account.id
			})
		);

		const returnValue: Array<AdminNotification | MemberNotification> = [];

		for (const i of results) {
			let fromMemberName: string | null = null;
			if (i.cause.type === NotificationCauseType.MEMBER) {
				const member = await resolveReference(i.cause.from, account, schema, true);

				fromMemberName = member.getFullName();
			}

			switch (i.target.type) {
				case NotificationTargetType.ADMINS:
					returnValue.push(
						new AdminNotification(
							{
								...i,
								toMemberName: null,
								fromMemberName
							},
							account,
							schema
						)
					);
					break;

				case NotificationTargetType.MEMBER:
					const toMember = await resolveReference(i.target.to, account, schema, true);
					returnValue.push(
						new MemberNotification(
							{
								...i,
								toMemberName: toMember.getFullName(),
								fromMemberName
							},
							account,
							schema
						)
					);
					break;
			}
		}

		return returnValue;
	}

	protected static async Create<T extends NotificationTarget>(
		data: NewNotificationObject,
		target: T,
		account: Account,
		schema: Schema
	): Promise<RawNotificationObject & Required<NoSQLDocument>> {
		const notificationCollection = schema.getCollection<RawNotificationObject>('Notifications');

		let id: number = 0;

		const notifGenerator = generateResults(
			findAndBind(notificationCollection, {
				accountID: account.id
			})
		);

		for await (const notif of notifGenerator) {
			id = Math.max(notif.id, id);
		}

		id++;

		const rawNotification: RawNotificationObject = {
			...data,
			id,
			target,
			accountID: account.id,
			archived: false,
			emailSent: false,
			created: Date.now(),
			read: false
		};

		const results = await notificationCollection.add(rawNotification).execute();

		return {
			...rawNotification,
			_id: results.getGeneratedIds()[0]
		};
	}

	public accountID: string;

	public id: number;

	public archived: boolean;

	public cause: NotificationCause;

	public created: number;

	public target: NotificationTarget;

	public text: string;

	public fromMemberName: string | null;

	public toMemberName: string | null;

	public get read(): boolean {
		return this.wasRead;
	}

	public emailSent: boolean;

	public extraData: NotificationData | null;

	// tslint:disable-next-line:variable-name
	public _id: string;

	private wasRead: boolean;

	protected constructor(
		data: NotificationObject & Required<NoSQLDocument>,
		private account: Account,
		private schema: Schema
	) {
		this.created = data.created;
		this.archived = data.archived;
		this.cause = data.cause;
		this.target = data.target;
		this.text = data.text;
		this.wasRead = data.read;
		this.emailSent = data.emailSent;
		this._id = data._id;
		this.accountID = data.accountID;
		this.id = data.id;
		this.fromMemberName = data.fromMemberName;
		this.toMemberName = data.toMemberName;
		this.extraData = data.extraData;
	}

	public async save() {
		const notificationCollection = this.schema.getCollection<RawNotificationObject>(
			'Notifications'
		);

		await notificationCollection.replaceOne(this._id, this.toRaw());
	}

	public toRaw(): RawNotificationObject {
		return {
			accountID: this.account.id,
			archived: this.archived,
			cause: this.cause,
			created: this.created,
			emailSent: this.emailSent,
			id: this.id,
			read: this.read,
			target: this.target,
			text: this.text,
			extraData: this.extraData
		};
	}

	public toFullRaw(): NotificationObject {
		return {
			...this.toRaw(),
			fromMemberName: this.fromMemberName,
			toMemberName: this.toMemberName
		};
	}

	public markAsRead() {
		this.wasRead = true;
	}

	public markAsUnread() {
		this.wasRead = false;
	}

	public async delete() {
		const notificationCollection = this.schema.getCollection<RawNotificationObject>(
			'Notifications'
		);

		await notificationCollection.removeOne(this._id);
	}

	public abstract canSee(member: MemberBase, account: Account): boolean;
}
