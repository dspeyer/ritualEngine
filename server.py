#!/usr/bin/env python

from aiohttp import web

from core import app
import rituals
import widgetry
import users

web.run_app(app)
