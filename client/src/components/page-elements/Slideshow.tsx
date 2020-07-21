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

import * as React from 'react';
import './Slideshow.scss';

interface SlideshowProps {
	fileIDs: string[];
}

interface SlideshowState {
	slideIndex: number;
}

export default class Slideshow extends React.PureComponent<SlideshowProps, SlideshowState> {
	public render() {
		return (
			<section className="slideshow-box">
				<div className="slideshow-top" />
				<div className="slideshow">
					<div className="image" />
				</div>
				<div className="slideshow-bottom" />
			</section>
		);
	}
}
