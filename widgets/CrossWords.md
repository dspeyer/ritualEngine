Each user enters a text string.  The strings are assembled according
to scrabble rules, and also combine to form a larger image.

## Parameters

  * widget: "CrossWords"
  * boxColors: Colors of boxes in SVG to put widgets on top of
      * content: The crossing words
      * input: The text entry
    },
  * image: The big image to form with the crossing words (filename)
  * size: Larger dimension of the grid, in letters (the aspect ratio
          is determined by the image)

## Upward Protocol

  * name: The text to place

## Downward Protocol

  * widget: "CrossWords"
  * boxColors: Same as in Parameters
  * data: A 2d array for the letter grid, each cell having:
     * t: The text to put in that cell, a single letter 
     * c: The color to make that letter, as #xxxxxx

  
