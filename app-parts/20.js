      // The room-sorted architecture view duplicated the primary Walls / Doors / Windows
      // browser and added unnecessary panel height. Keep its DOM nodes for legacy render
      // functions, but remove the tab from the visible interface.
      const architectureRoomTabV28=$('architectureRoomList')?.closest('details.toggle-group');
      if(architectureRoomTabV28){architectureRoomTabV28.hidden=true;architectureRoomTabV28.style.display='none';}
