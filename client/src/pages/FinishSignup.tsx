import React from 'react';
import Page, { PageProps } from './Page';
import SimpleForm, { Label, Title, TextBox, TextInput } from '../components/forms/SimpleForm';
import PasswordForm from '../components/form-inputs/PasswordForm';
import myFetch, { fetchFunction } from '../lib/myFetch';
import { getMember } from '../lib/Members';

interface FormValues {
	username: string;
	password: null | string;
}

interface FinishSignupState {
	form: FormValues;
	error: string | null;
	success: boolean;
	tryingFinish: boolean;
}

export default class FinishSignup extends Page<PageProps<{ token: string }>, FinishSignupState> {
	public state: FinishSignupState = {
		form: {
			password: null,
			username: ''
		},
		error: null,
		success: false,
		tryingFinish: false
	};

	constructor(props: PageProps<{ token: string }>) {
		super(props);

		this.finishAccount = this.finishAccount.bind(this);
	}

	public render() {
		return (
			<SimpleForm<FormValues>
				disableOnInvalid={true}
				values={this.state.form}
				onChange={form => this.setState({ form })}
				validator={{
					username: name => !!name && name.length > 0 && name.length < 45,
					password: password => password !== null
				}}
				onSubmit={this.finishAccount}
				submitInfo={{
					disabled: this.state.tryingFinish,
					text: this.state.tryingFinish ? 'Finalizing...' : 'Finish creating account'
				}}
			>
				<Title>Finish account setup</Title>

				{this.state.error !== null ? <Label /> : null}
				{this.state.error !== null ? (
					<TextBox>
						<b style={{ color: 'red' }}>{this.state.error}</b>
					</TextBox>
				) : null}

				<Label />
				<TextBox>
					Please select a user name for use in authenticating your access to CAPUnit.com.
					<br />
					User names should be 45 characters or less. Only one user name may be associated
					with each CAPID.
					<br />
				</TextBox>

				<Label>Please choose a username</Label>
				<TextInput name="username" />

				<PasswordForm name="password" />
			</SimpleForm>
		);
	}

	private async finishAccount() {
		const token = this.props.routeProps.match.params.token;
		const { username, password } = this.state.form;

		try {
			const fetchResult = await fetchFunction('/api/member/account/nhq/finish', {
				body: JSON.stringify({
					token,
					username,
					password
				}),
				headers: {
					'content-type': 'application/json'
				},
				method: 'POST'
			});

			const result: { error: string; sessionID?: string } = await fetchResult.json();

			if (result.error === 'none') {
				const sessionID = result.sessionID!;

				const member = await getMember(sessionID);

				this.props.authorizeUser(member);
				this.props.routeProps.history.push('/admin');
			} else {
				this.setState({
					tryingFinish: false,
					error: result.error
				});
			}
		} catch (e) {
			this.setState({
				error: 'Could not connect to server',
				success: false
			});
		}
	}
}
