-- Demo data: 5 stars, 2-3 planets per star
-- created_by is nullable for demo bootstrap without auth users

insert into stars (id, name, color, x_coord, y_coord, created_by) values
('10000000-0000-0000-0000-000000000001', '#tech',   '#6ec1ff', -700, -300, null),
('10000000-0000-0000-0000-000000000002', '#travel', '#ffb36b',  600, -450, null),
('10000000-0000-0000-0000-000000000003', '#food',   '#ffd166', -200,  550, null),
('10000000-0000-0000-0000-000000000004', '#fitness','#80ed99',  900,  300, null),
('10000000-0000-0000-0000-000000000005', '#music',  '#c77dff', -950,  420, null)
on conflict (id) do nothing;

insert into planets (id, star_id, title, video_url, thumbnail_url, description, created_by, orbit_radius, orbit_speed) values
('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Node Tips', 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', null, 'Best backend snippets', null, 110, 0.00010),
('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'CSS Nebula', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', null, 'UI ideas', null, 170, 0.00008),
('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', 'Weekend Rome', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', null, 'Travel reel', null, 120, 0.00011),
('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Tokyo Night', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', null, 'City lights', null, 190, 0.00007),
('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', 'Pasta Creamy', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', null, 'Recipe in 30s', null, 115, 0.00010),
('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', 'Street Food', 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4', null, 'Street taste', null, 180, 0.00009),
('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000004', 'Morning Workout', 'https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', null, 'Home routine', null, 130, 0.00010),
('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000004', 'Mobility Flow', 'https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', null, 'Stretching', null, 200, 0.00007),
('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000005', 'Lo-fi Beat', 'https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4', null, 'Relax vibes', null, 125, 0.00011),
('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000005', 'Indie Session', 'https://storage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4', null, 'Acoustic session', null, 175, 0.00009)
on conflict (id) do nothing;
