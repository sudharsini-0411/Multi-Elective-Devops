import unittest
from allocation import (
    calculate_lambda,
    calculate_priority_score,
    get_prsm_satisfaction,
    apply_raa,
    simulate_allocation
)

class TestFairElectAlgorithms(unittest.TestCase):

    def test_calculate_lambda(self):
        # 1. Below threshold (0.5), lambda should increase
        # h_prev = 0.2, theta = 0.5, lambda_base = 0.3, gamma = 1.0
        # Expected: 0.3 + 1.0 * (0.5 - 0.2) = 0.6
        l_low = calculate_lambda(0.2, theta=0.5, lambda_base=0.3, gamma=1.0)
        self.assertAlmostEqual(l_low, 0.6)

        # 2. Below threshold with clipping to 1.0
        # h_prev = 0.0, theta = 0.5, lambda_base = 0.3, gamma = 2.0
        # Expected: min(1.0, 0.3 + 2.0 * 0.5) = min(1.0, 1.3) = 1.0
        l_clip_high = calculate_lambda(0.0, theta=0.5, lambda_base=0.3, gamma=2.0)
        self.assertAlmostEqual(l_clip_high, 1.0)

        # 3. Above threshold (0.5), lambda should decrease
        # h_prev = 0.8, theta = 0.5, lambda_base = 0.3, beta = 0.5
        # Expected: max(0.0, 0.3 - 0.5 * (0.8 - 0.5)) = max(0.0, 0.3 - 0.15) = 0.15
        l_high = calculate_lambda(0.8, theta=0.5, lambda_base=0.3, beta=0.5)
        self.assertAlmostEqual(l_high, 0.15)

        # 4. Above threshold with clipping to 0.0
        # h_prev = 0.9, theta = 0.5, lambda_base = 0.1, beta = 1.0
        # Expected: max(0.0, 0.1 - 1.0 * 0.4) = 0.0
        l_clip_low = calculate_lambda(0.9, theta=0.5, lambda_base=0.1, beta=1.0)
        self.assertAlmostEqual(l_clip_low, 0.0)

    def test_calculate_priority_score(self):
        # Points = 315, lambda = 0.6, fairness_score = 0.375
        # Expected: 315 + 0.6 * (0.375 * 100) = 315 + 22.5 = 337.5
        score = calculate_priority_score(315, 0.6, 0.375)
        self.assertAlmostEqual(score, 337.5)

    def test_get_prsm_satisfaction(self):
        # Rank 1 out of 5 preferences: 1.0 - (0 / 5) = 1.0
        self.assertAlmostEqual(get_prsm_satisfaction(1, 5), 1.0)
        # Rank 3 out of 5 preferences: 1.0 - (2 / 5) = 0.6
        self.assertAlmostEqual(get_prsm_satisfaction(3, 5), 0.6)
        # Rank 5 out of 5 preferences: 1.0 - (4 / 5) = 0.2
        self.assertAlmostEqual(get_prsm_satisfaction(5, 5), 0.2)
        # Rank None or 0 preferences
        self.assertAlmostEqual(get_prsm_satisfaction(None, 5), 0.0)
        self.assertAlmostEqual(get_prsm_satisfaction(2, 0), 0.0)

    def test_apply_raa(self):
        # h_prev = 0.5, s_curr = 1.0, alpha = 0.6
        # Expected: 0.6 * 0.5 + 0.4 * 1.0 = 0.3 + 0.4 = 0.7
        h_new = apply_raa(0.5, 1.0, alpha=0.6)
        self.assertAlmostEqual(h_new, 0.7)

    def test_simulate_allocation(self):
        # Setup small simulation with 2 students and 2 electives
        # Elective 1 has only 1 seat
        students = [
            {'id': 1, 'username': 'student_a', 'historical_satisfaction': 0.1}, # neglected
            {'id': 2, 'username': 'student_b', 'historical_satisfaction': 0.9}  # satisfied
        ]
        electives = [
            {'id': 1, 'code': 'EL1', 'name': 'Popular Elective', 'capacity': 1, 'seats_remaining': 1},
            {'id': 2, 'code': 'EL2', 'name': 'Less Popular Elective', 'capacity': 2, 'seats_remaining': 2}
        ]
        preferences = [
            # Student A: EL1 (350 pts, rank 1), EL2 (150 pts, rank 2)
            {'user_id': 1, 'elective_id': 1, 'points': 350, 'rank': 1},
            {'user_id': 1, 'elective_id': 2, 'points': 150, 'rank': 2},
            # Student B: EL1 (450 pts, rank 1), EL2 (50 pts, rank 2)
            {'user_id': 2, 'elective_id': 1, 'points': 450, 'rank': 1},
            {'user_id': 2, 'elective_id': 2, 'points': 50, 'rank': 2}
        ]

        # Let's run simulation
        trace, allocations, updated_students = simulate_allocation(
            students, electives, preferences, max_electives=1
        )
        
        # Verify that Student B gets EL1 because their higher bidding points (450) override
        # Student A's priority boost (which is capped at 100 max fairness component).
        # Let's check who was allocated EL1.
        el1_alloc = [a for a in allocations if a['elective_code'] == 'EL1']
        self.assertEqual(len(el1_alloc), 1)
        self.assertEqual(el1_alloc[0]['user_id'], 2) # Student B should get it!
        
        # Student A should get EL2 instead
        el2_alloc = [a for a in allocations if a['elective_code'] == 'EL2']
        self.assertEqual(len(el2_alloc), 1)
        self.assertEqual(el2_alloc[0]['user_id'], 1)

    def test_new_student_random_allocation(self):
        # A new student is in new_student_ids
        students = [
            {'id': 1, 'username': 'student_a', 'historical_satisfaction': 0.0}
        ]
        electives = [
            {'id': 1, 'code': 'EL1', 'name': 'Popular Elective', 'capacity': 1, 'seats_remaining': 1}
        ]
        preferences = [
            {'user_id': 1, 'elective_id': 1, 'points': 500, 'rank': 1}
        ]
        
        # Test simulation run with student_a as new
        trace, allocations, updated_students = simulate_allocation(
            students, electives, preferences, max_electives=1, new_student_ids={1}
        )
        
        # New student should be allocated
        self.assertEqual(len(allocations), 1)
        self.assertEqual(allocations[0]['user_id'], 1)
        
        # Verify the priority score is not calculated using normal formula (e.g. priority is a random float)
        # We can run it multiple times or inspect the trace to see if priority score works.
        self.assertTrue('score' in trace[0])
        self.assertTrue(0.0 <= trace[0]['score'] <= 1.0)

if __name__ == "__main__":
    unittest.main()
