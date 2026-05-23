// @open license with citation
// @please feel free to reuse this code for any purpose, citing dougx.net
// @see http://dougx.net/plunder/license.txt for MIT open license text


function keyDown(e)
{
   e.preventDefault();

   //dbg(e.keyCode + "down", false);

   if ( e.keyCode == 80 )         // p
   {
      pause();
   }

   if (g_paused)
      return;

   if ( e.keyCode == 38 || e.keyCode == 87 )         // up arrow or W
   {
      g_ship.up(true);
   }
   else if ( e.keyCode == 40 || e.keyCode == 83 )    // down arrow or S
   {
      g_ship.down(true);
   }
   else if ( e.keyCode == 37 || e.keyCode == 65 )    // left arrow or A
   {
      g_ship.left(true);
   }
   else if ( e.keyCode == 39 || e.keyCode == 68 )    // right arrow or D
   {
      g_ship.right(true);
   }
   else if ( e.keyCode == 32 )                       // space
   {
      g_ship.fire(true);
   }
}
function keyUp(e)
{
   e.preventDefault();

   //dbg(e.keyCode + "up", false);

   if ( e.keyCode == 38 || e.keyCode == 87 )         // up arrow or W
   {
      g_ship.up(false);
   }
   else if ( e.keyCode == 40 || e.keyCode == 83 )    // down arrow or S
   {
      g_ship.down(false);
   }
   else if ( e.keyCode == 37 || e.keyCode == 65 )    // left arrow or A
   {
      g_ship.left(false);
   }
   else if ( e.keyCode == 39 || e.keyCode == 68 )    // right arrow or D
   {
      g_ship.right(false);
   }
   else if ( e.keyCode == 32 )                       // space
   {
      g_ship.fire(false);
   }
}
