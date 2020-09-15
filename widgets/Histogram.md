Each participant does some talking and then sends a value.  The values
form a histogram.  Each participant is represented by a photo they
already uploaded, or, if not available, a yellow circle.

We use the uploaded photos (from a previous photocollage) and not the
user avatars for two reasons:

1) They're rectangles, not circles
2) This way we don't have to disambiguate multi-participant browsers

## Parameters

  * widget: "Histogram",
  * images: the `saveas` from a previous PhotoCollage
  * boxColors: Colors of boxes in the svg
      * input: Where to put the value input box
      * result: Where to draw the graph (will overhang the bottom a little)
      * turn: Where to put the "it is your turn to talk" box (no longer used)
    },
  * saveas: tag to save data in, since we might want it later.  Also
            tag to load old data from.
  * initRange: [start,end] to display before there is any data.  Not
               needed if we got data from saveas
  

## Upward Protocol

  * x: The value to take a histogram of


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

## Subpaging

We use number of images as a subpage.  It may not actually be needed.