import time
import timeit
import random

def generate_results(n):
    intents = ['Transaccional', 'Comercial', 'Informacional', 'Navegacional', 'Ambiguo / General']
    return [{'intent': random.choice(intents)} for _ in range(n)]

# Generate a large list to make the timing noticeable
results = generate_results(10000)

def test_original():
    stats = {
        'trans': len([x for x in results if 'Transaccional' in x['intent']]),
        'comm': len([x for x in results if 'Comercial' in x['intent']]),
        'info': len([x for x in results if 'Informacional' in x['intent']]),
        'nav': len([x for x in results if 'Navegacional' in x['intent']]),
    }
    return stats

def test_optimized():
    stats = {'trans': 0, 'comm': 0, 'info': 0, 'nav': 0}
    for x in results:
        intent = x.get('intent', '')
        if 'Transaccional' in intent:
            stats['trans'] += 1
        elif 'Comercial' in intent:
            stats['comm'] += 1
        elif 'Informacional' in intent:
            stats['info'] += 1
        elif 'Navegacional' in intent:
            stats['nav'] += 1
    return stats

if __name__ == '__main__':
    # Verify correctness
    assert test_original() == test_optimized(), "Outputs do not match!"

    # Run benchmarks
    iterations = 1000

    t_original = timeit.timeit(test_original, number=iterations)
    t_optimized = timeit.timeit(test_optimized, number=iterations)

    print(f"Original: {t_original:.4f} seconds")
    print(f"Optimized: {t_optimized:.4f} seconds")
    print(f"Improvement: {((t_original - t_optimized) / t_original) * 100:.2f}%")
