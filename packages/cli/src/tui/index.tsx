#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';

const source = process.argv[2] || '.';

render(<App source={source} />);
