import random
from typing import List, Dict, Tuple


class AIOpponent:
    """
    AI opponent logic for Battleship game.
    
    Difficulty Level: Medium
    - Random ship placement
    - Random initial shots
    - Smart hunting after hits (checks adjacent cells)
    - No advanced heuristics or AI learning
    """
    
    # Ship types and their sizes
    SHIPS = {
        'battleship': 4,
        'cruiser': 3,
        'destroyer': 2,
        'submarine': 1,
    }
    
    BOARD_SIZE = 10
    
    def __init__(self):
        """Initialize AI opponent."""
        self.last_hit = None
        self.hunting_mode = False
        self.potential_targets = []
    
    def generate_initial_board(self) -> Dict:
        """
        Generate AI's initial board with random ship placement.
        
        Returns:
            dict: Board state with ship positions
        """
        board = {
            'grid': self._create_empty_grid(),
            'ships': {},
            'hits': [],
            'misses': [],
        }
        
        # Place ships randomly
        for ship_name, ship_size in self.SHIPS.items():
            positions = self._find_valid_ship_placement(board, ship_size)
            board['ships'][ship_name] = {
                'size': ship_size,
                'positions': positions,
                'hits': 0,
            }
            # Mark positions on grid
            for pos in positions:
                board['grid'][pos['x']][pos['y']] = ship_name
        
        return board
    
    def get_next_move(self, ai_board: Dict, opponent_board: Dict) -> Dict:
        """
        Determine AI's next move.
        
        Returns:
            dict: Move with 'target': {'x': int, 'y': int}
        """
        # If we hit something, hunt for the rest of the ship
        if self.hunting_mode and self.potential_targets:
            target = self.potential_targets.pop(0)
            return {'target': target}
        
        # Otherwise, take a random shot at unexplored area
        target = self._get_random_target(opponent_board)
        return {'target': target}
    
    def process_shot_result(self, target: Dict, hit: bool, ai_board: Dict):
        """
        Process the result of a shot taken by the AI.
        
        Args:
            target: Shot target {'x': int, 'y': int}
            hit: Whether the shot was a hit
            ai_board: Current AI board state
        """
        if hit:
            ai_board['hits'].append(target)
            self.last_hit = target
            self.hunting_mode = True
            
            # Generate potential targets (adjacent cells)
            self._generate_hunting_targets(target, ai_board)
        else:
            ai_board['misses'].append(target)
            
            # If we've exhausted hunting targets, switch back to random
            if not self.potential_targets:
                self.hunting_mode = False
                self.last_hit = None
    
    def _create_empty_grid(self) -> List[List]:
        """Create an empty 10x10 grid."""
        return [[None for _ in range(self.BOARD_SIZE)] 
                for _ in range(self.BOARD_SIZE)]
    
    def _find_valid_ship_placement(self, board: Dict, ship_size: int) -> List[Dict]:
        """
        Find a valid placement for a ship of given size.
        
        Returns:
            list: List of position dicts [{'x': int, 'y': int}, ...]
        """
        max_attempts = 100
        attempt = 0
        
        while attempt < max_attempts:
            # Random orientation (horizontal or vertical)
            horizontal = random.choice([True, False])
            
            if horizontal:
                x = random.randint(0, self.BOARD_SIZE - ship_size)
                y = random.randint(0, self.BOARD_SIZE - 1)
                positions = [{'x': x + i, 'y': y} for i in range(ship_size)]
            else:
                x = random.randint(0, self.BOARD_SIZE - 1)
                y = random.randint(0, self.BOARD_SIZE - ship_size)
                positions = [{'x': x, 'y': y + i} for i in range(ship_size)]
            
            # Check if placement is valid
            if self._is_valid_placement(board, positions):
                return positions
            
            attempt += 1
        
        # Fallback: place at a safe position
        return [{'x': 0, 'y': 0}]
    
    def _is_valid_placement(self, board: Dict, positions: List[Dict]) -> bool:
        """
        Check if ship placement is valid (no overlaps, within bounds).
        
        Args:
            board: Current board state
            positions: Proposed ship positions
            
        Returns:
            bool: True if placement is valid
        """
        # Check bounds
        for pos in positions:
            if pos['x'] < 0 or pos['x'] >= self.BOARD_SIZE:
                return False
            if pos['y'] < 0 or pos['y'] >= self.BOARD_SIZE:
                return False
        
        # Check for overlaps with existing ships
        for pos in positions:
            if board['grid'][pos['x']][pos['y']] is not None:
                return False
        
        return True
    
    def _get_random_target(self, opponent_board: Dict) -> Dict:
        """
        Get a random target that hasn't been shot at yet.
        
        Args:
            opponent_board: Opponent's board state (shots taken against them)
            
        Returns:
            dict: Target position {'x': int, 'y': int}
        """
        already_shot = [
            shot['target'] for shot in opponent_board.get('shots', [])
        ]
        
        max_attempts = 100
        attempt = 0
        
        while attempt < max_attempts:
            x = random.randint(0, self.BOARD_SIZE - 1)
            y = random.randint(0, self.BOARD_SIZE - 1)
            target = {'x': x, 'y': y}
            
            if target not in already_shot:
                return target
            
            attempt += 1
        
        # Fallback: find any unshot position
        for x in range(self.BOARD_SIZE):
            for y in range(self.BOARD_SIZE):
                target = {'x': x, 'y': y}
                if target not in already_shot:
                    return target
        
        return {'x': 0, 'y': 0}
    
    def _generate_hunting_targets(self, hit_target: Dict, ai_board: Dict):
        """
        Generate adjacent cells to hunt for the rest of the ship.
        
        Args:
            hit_target: The position of the hit
            ai_board: Current AI board state
        """
        already_shot = [
            shot['target'] for shot in ai_board.get('shots', [])
        ]
        already_shot.extend(ai_board.get('hits', []))
        already_shot.extend(ai_board.get('misses', []))
        
        # Check 4 adjacent cells (up, down, left, right)
        adjacent = [
            {'x': hit_target['x'] - 1, 'y': hit_target['y']},  # up
            {'x': hit_target['x'] + 1, 'y': hit_target['y']},  # down
            {'x': hit_target['x'], 'y': hit_target['y'] - 1},  # left
            {'x': hit_target['x'], 'y': hit_target['y'] + 1},  # right
        ]
        
        for target in adjacent:
            # Check bounds
            if (0 <= target['x'] < self.BOARD_SIZE and
                0 <= target['y'] < self.BOARD_SIZE and
                target not in already_shot):
                self.potential_targets.append(target)
        
        # Shuffle to avoid obvious patterns
        random.shuffle(self.potential_targets)
    
    def reset(self):
        """Reset AI state for a new game."""
        self.last_hit = None
        self.hunting_mode = False
        self.potential_targets = []
