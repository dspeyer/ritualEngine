#!/usr/bin/env python

from aiohttp import web
import sentry_sdk
from sentry_sdk.integrations.aiohttp import AioHttpIntegration

from core import app, secrets
import rituals
import widgetry
import users

try:
    sentry_dsn = secrets['SENTRY_DSN']
except KeyError:
    pass
else:
    sentry_sdk.init(dsn=sentry_dsn, integrations=[AioHttpIntegration()])

web.run_app(app)
