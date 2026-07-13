      // Ensure wall and camera world matrices are current before cutaway raycasting,
      // including the first frame after a project or scene rebuild.
      const automaticBlockingWallIdsBeforeMatrixRefresh=automaticBlockingWallIds;
      automaticBlockingWallIds=function(settings){
        scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
        return automaticBlockingWallIdsBeforeMatrixRefresh(settings);
      };
