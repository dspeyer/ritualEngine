# Slides For Distributed Rituals

Everybody gets to partake of the same slides, and they can contain
widgets to create a feeling of presence and community.

## Glossary

**Script:** A series of things to do in a ritual    
**Ritual:** An instance of a group of people doing those things    
**Widget:** A specific action within a script, and the technology to
enable it

So, Petrov Day is a script, the Petrov Day observance for NYC-adjacent
people in 2020 is a ritual, and the time everyone photographs
themselves with their candles is a widget.

Every instance of each of these things must have a unique name.

## Script Definition

A script is implemented as a directory of numbered pages.  The
numbering begins at 1.

There's also an `index.json` with global instructions (currently just
a background image).

Each page has an svg to be displayed, and optionally a json to control
behavior.  The json has a `widget` tag to indicate what widget is to
be used, and parameters appropriate to that widget.  If the widget is
going to display UI, the svg should have uniquely colored boxes for
where the UI goes, and supply the colors in the json.

## General Protocol

A web browser connecting to a ritual uses the url `/${ritualName}/`.  

Once connected, the browser GETs
`/${ritualName/status?have={page}&subhave=${subpage}`.  If the
parameters describe the current state of the ritual, the request waits
until something changes or a timeout occurs.  In any case, status then
describes the overall state of the ritual.

The statuses are intended as descriptive and idempotent.  A user who
joins partway through or who missed a past message should see the same
thing as one who's been present all along.

Meanwhile, any client may POST `/${ritualName}/nextPage` to advance,
or `/${ritualName}/widgetData` to interact with the current widget.
Doing this will cause all outstanding `/status` requests for the
ritual to complete.

## Requirements

This system uses python3.8 for asyncio.  Installing this in ubuntu
isn't too difficult, but the library directories *will* be broken and
a virtualenv is the only practical solution.

The Javascript is very ES6.  It's tested on Chrome 77 and
Mobile Opera 59.  So it's probably fine on recent Firefox and Safari
too.

The Video API used in PhotoCollage is https only.  The server does not
support https, so it must be reverse-proxied by something that does
(tested in Apache, but nginx is probably easier).

## Widget API

A widget is defined with three files, all in the `widgets` directory,
all with the widget's name as their basename.

### Server-Side

The widget.py file defines a class, also with the widget's name.  The
class must have three functions:

**A constructor** which takes the terms in the json definition file as
  named parameters.  It will also receive a named parameter `ritual`
  which is the ritual object it is a part of.  The widget will be
  destroyed when the ritual moves on, but it may leave things in the
  ritual object if it wishes.  For future-proofing purposes, a widget
  should ignore unrecognized named parameters.

**`from_client`** which receives data.  It gets two arguments, `data`
  which is a `MultiDictProxy` of client data straight from `aiohttp`,
  an `ip` which is the client's ip as a string.  This function does
  not return data to the client.  It modifies the widget's state for
  when `to_client` gets called.

**`to_client`** which sends data.  It returns a python object which
  will go to the client side.  The object must be json-encodable.

A widget class may also define:

**`subpagesame`** which checks if the subpage a client sends matches
  the current state.  This ensures that a client which falls behind in
  updates somehow doesn't have to wait for a timeout or event to catch
  up.  In practice, it's only needed if the client immediately sends
  data upon initialization.  This function takes a single argument,
  the subpage as a string.

The widget class must be imported by `server.py`

### Client Side

The .js file also defines a class with the widget's name.  The class
also has three functions:

**A constructor** which takes the first batch of data from the client
  as its input (using named argument struct unpacking is
  recommended).  Note that `from_server` will be called immediately
  after construction with the same argument[s], so do not duplicate
  functionality.

**`from_server`** which receives new state from the server

**`destroy`** which is called before leaving the page.  It should
  remove any UI the widget has added to the DOM.

The client class may also define a value `page` which will be passed
to the client's `subpagesame` function.  Note that this is a value,
not a function to be called.

The client must end with

    widgetClasses.ClassName = ClassName;

because javascript is weird about global variables.

When the client wishes to send data to the server, it may invoke POST
directly with $.post('widgetData',{k:v,k2:v2,...}).  Note that these
POSTs will not receive responses beyond 204 No Content, but will
(barring special server logic) trigger an update from the server which
will be processed by a separate `from_server` invocation.

## Documentation

Each widget should have its own documentation, in markdown format.
Said documentation should cover at minimum the protocol it speaks and
any deep weirdness in its design.