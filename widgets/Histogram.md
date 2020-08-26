Each participant does some talking and then sends a value.  The values
form a histogram.  Each participant is represented by a photo they
already uploaded, or, if not available, a yellow circle.

To allow users to go in an order, each client "rolls initiative".  The
server then keeps track of all initiatives that haven't gone yet.
This is robust against most weird things that could happen with
clients, except that a client that disappears (e.g. by reloading the
page) will keep its place in the initiative order and need to be
skipped manually.

## Parameters

  * widget: "Histogram",
  * images: the `saveas` from a previous PhotoCollage
  * boxColors: Colors of boxes in the svg
      * input: Where to put the value input box
      * result: Where to draw the graph (will overhang the bottom a little)
      * turn: Where to put the "it is your turn to talk" box
    },
  * saveas: tag to save data in, since we might want it later.  Also
            tag to load old data from.
  * initRange: [start,end] to display before there is any data.  Not
               needed if we got data from saveas
  

## Upward Protocol

  * initiative: The initiative of the client being spoken of, usually
                the one speaking
  * x: The value to take a histogram of

If x is absent, this tells the server that a client of this initiative
exists.

If x is -9999 (a value which will hopefully never be used for real),
nothing is added to the histogram, but the listed initiative is
treated as gone anyway.

## Downward Protocol

  * widget: "Histogram",
  * boxColors: Exactly what's in the parameters
  * imgs: The data, a list of:
     * imgId: The number for the image, which can be gotten as /$ritName/img/$imgId.jpg
     * x: The X coordinate of where the image should wind up, as a
           percentage of way across the graph
     * y: The Y coordinate, also a percentage, up is positive
     * w: Image width, as a percentage of total graph
     * h: Image height, as a percentage of the graph's *width*
  * xaxes: X axes labels, a list of:
     * x: Where to put the label, again a percentage
     * v: Value the label corresponds to, drawn as text
  * initiatives: List of initiatives which have not gone yet

## Subpaging

We use number of not-yet-gone initiatives as a subpage.  This is
needed to get startup working.