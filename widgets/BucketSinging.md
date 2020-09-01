This invokes [Bucket Brigade Singing](https://github.com/gwillen/solstice-audio-test).

The server spins up a separate BBS server.  The BBS client is then
downloaded, and the widget here merely commands it.

The BBS server will run on a *different port*, which the main server
will look for by trying 8081, 8082, etc.  This port must be presented
by the reverse proxy using a template described in the environment
variable `PORT_FORWARD_TEMPLATE` (default `/%d`), rather than as a separate
port, in order to make relative links work.  As usual, the reverse
proxy must also terminate the https connection, as the BBS server does
not speak ssl.  The BBS server will be terminated when the slide is
advanced.

(Since most reverse proxies require a list of paths with no wildcards,
there is an effective limit on how many concurrent rituals can do
bucket singing at once.)

The main server looks for the BBS files in the directory pointed to by
the environment environment variable `BUCKET_PATH` or to
`../solstice-audio-test` if the variable is unset.  The relative path
is relative to the working directory, presumed to be the base
directory for the main server.

## Parameters

   * widget: "BucketSinging"
   * boxColor: One big box to put all the UI in
   * lyrics: A list of lines of text.  Note that lines *can* contain
     newline characters, and will be displayed as such.

## Upward Protocol

   * client_id: A random value to help in identifying clients and
     determining order

Note that this upload only occurs once.  All other data, both audio
and lyric-clicking, is sent directly to the BBS server.

## Downward Protocol

    * widget: 'BucketSinging',
    * lyrics: The same as in Parameters
    * boxColor: The same as in Parameters
    * server_url: Base path for the BBS server, as seen from the
      client (i.e. as presented by the reverse proxy)
    * client_ids: All client ids in order of connection, so the client
      can compute its place in the series

